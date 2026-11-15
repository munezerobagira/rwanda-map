"""Anonymous offline Overture building import; no names or addresses retained.
Usage: python scripts/ingest-overture-buildings.py RELEASE COUNTRY_MASK OUTPUT_ROOT
Requires requirements-overture.txt. Only building objects, never building parts.
Public source releases expire; preserve lawful minimized immutable dated outputs.
"""
import json, math, gzip, sqlite3, hashlib, time, sys, importlib.metadata
from pathlib import Path
import numpy as np
import shapely
from pyproj import Geod
from overturemaps.core import _prepare_query
assert importlib.metadata.version('overturemaps')=='2.1.1','Review query adapter after client changes'
release=sys.argv[1]
root=Path(sys.argv[3])/release
root.mkdir(parents=True,exist_ok=False)
mask_bytes=Path(sys.argv[2]).read_bytes()
mask_doc=json.loads(mask_bytes);mask=shapely.geometry.shape(mask_doc['geometry']);shapely.prepare(mask)
started=time.monotonic()
print('query',release,mask.bounds,flush=True)
prepared=_prepare_query('building',bbox=mask.bounds,release=release,connect_timeout=10,request_timeout=60,stac=True)
if prepared is None:raise ValueError('No source files')
dataset,expression=prepared
print('spatially pruned source files',len(dataset.files),flush=True)
scanner=dataset.scanner(columns=['id','geometry','subtype','class','sources'],filter=expression,batch_size=8192,batch_readahead=1,fragment_readahead=1,use_threads=True)
connection=sqlite3.connect(root/'minimized.sqlite')
connection.execute('PRAGMA journal_mode=OFF');connection.execute('PRAGMA synchronous=OFF')
connection.execute('CREATE TABLE buildings(id TEXT PRIMARY KEY,x INT,y INT,lon INT,lat INT,area INT,use INT,source INT,confidence INT,geometry TEXT)')
geod=Geod(ellps='WGS84');stats={'sourceRows':0,'accepted':0,'invalid':0,'outside':0};types={};sources={}
for batch in scanner.to_batches():
 stats['sourceRows']+=len(batch)
 geometries=shapely.from_wkb(batch.column('geometry').to_pylist())
 good=shapely.is_valid(geometries)&~shapely.is_empty(geometries)&np.isin(shapely.get_type_id(geometries),[3,6])
 stats['invalid']+=int((~good).sum())
 indexes=np.flatnonzero(good)
 geometries=geometries[indexes]
 centers=shapely.centroid(geometries)
 fallback=~shapely.covers(geometries,centers)
 centers[fallback]=shapely.point_on_surface(geometries[fallback])
 lon=np.round(shapely.get_x(centers),6);lat=np.round(shapely.get_y(centers),6)
 inside=shapely.covers(mask,shapely.points(lon,lat))
 stats['outside']+=int((~inside).sum())
 rows=[]
 for k in np.flatnonzero(inside):
  row=batch.slice(int(indexes[k]),1).to_pylist()[0]
  g=geometries[k];x=float(lon[k]);y=float(lat[k]);sub=row['subtype'];kind=row['class']
  category=1 if kind in ('detached','semidetached_house','terrace','bungalow','house') else 2 if sub=='residential' else 3 if sub in ('agricultural','civic','commercial','industrial','military','outbuilding','religious','service','transportation') else 0
  src=0;conf=-1
  for source in row['sources'] or []:
   name=source.get('dataset','unknown');sources[name]=sources.get(name,0)+1
   src|={'OpenStreetMap':1,'Google Open Buildings':2,'Microsoft ML Buildings':4}.get(name,8)
   c=source.get('confidence')
   if isinstance(c,(float,int)) and 0<=c<=1:conf=max(conf,round(c*100))
  area=max(1,round(abs(geod.geometry_area_perimeter(g)[0])))
  tx=math.floor((x+180)/360*4096);ty=math.floor((1-math.asinh(math.tan(math.radians(y)))/math.pi)/2*4096)
  # Store only polygon coordinates (rounding is positional quantization, not accuracy).
  simple=shapely.set_precision(g,grid_size=.000001)
  if simple.is_empty:simple=g
  coordinates=shapely.geometry.mapping(simple)
  geom=json.dumps([coordinates['type'],coordinates['coordinates']],separators=(',',':'))
  rows.append((row['id'],tx,ty,round(x*1e6),round(y*1e6),area,category,src,conf,geom))
  types[category]=types.get(category,0)+1
 connection.executemany('INSERT INTO buildings VALUES (?,?,?,?,?,?,?,?,?,?)',rows)
 connection.commit();stats['accepted']+=len(rows)
 if stats['sourceRows']//100000 != (stats['sourceRows']-len(batch))//100000:print(stats,'seconds',round(time.monotonic()-started),flush=True)
connection.execute('CREATE INDEX tile_index ON buildings(x,y)');connection.commit()
point_dir=root/'points';point_dir.mkdir();tiles={}
for x,y in connection.execute('SELECT DISTINCT x,y FROM buildings ORDER BY x,y'):
 rows=list(connection.execute('SELECT id,lon,lat,area,use,source,confidence FROM buildings WHERE x=? AND y=? ORDER BY id',(x,y)))
 data=gzip.compress(json.dumps(rows,separators=(',',':')).encode(),mtime=0)
 name=f'{x}_{y}';(point_dir/(name+'.json.gz')).write_bytes(data)
 tiles[name]={'count':len(rows),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
manifest={'source':'Overture Maps Foundation','release':release,'license':'ODbL-1.0','attribution':'© OpenStreetMap contributors, Overture Maps Foundation; Google Open Buildings; Microsoft ML Buildings','queryFiles':dataset.files,'countryMask':mask_doc['properties'],'countryMaskSha256':hashlib.sha256(mask_bytes).hexdigest(),'statistics':stats,'useClasses':types,'sourceCounts':sources,'pointTiles':tiles,'seconds':time.monotonic()-started,'pointCompressedBytes':sum(v['bytes'] for v in tiles.values())}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('DONE',stats,'bytes',manifest['pointCompressedBytes'],'seconds',round(manifest['seconds']),flush=True)
