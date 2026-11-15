"""Meaningful ingestion fixture: relation/way dedup, holes, privacy, source hash."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import osmium

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'ingest-osm-buildings.py'

class IngestionTest(unittest.TestCase):
    def test_relation_dedup_and_private_tags_do_not_survive(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pbf = root / 'fixture.osm.pbf'
            header = osmium.io.Header()
            header.set('osmosis_replication_timestamp', '2025-01-01T21:21:00Z')
            writer = osmium.SimpleWriter(str(pbf), header=header)
            points = [(30,-2),(30.001,-2),(30.001,-1.999),(30,-1.999),
                      (30.0002,-1.9998),(30.0008,-1.9998),(30.0008,-1.9992),(30.0002,-1.9992),
                      (30.002,-2),(30.003,-2),(30.003,-1.999),(30.002,-1.999)]
            for index,(lon,lat) in enumerate(points,1):
                writer.add_node(osmium.osm.mutable.Node(id=index,location=(lon,lat)))
            writer.add_way(osmium.osm.mutable.Way(id=10,nodes=[1,2,3,4,1],tags={'building':'house','owner':'PRIVATE_FIXTURE_OWNER','addr:street':'PRIVATE_FIXTURE_ADDRESS'}))
            writer.add_way(osmium.osm.mutable.Way(id=11,nodes=[5,6,7,8,5]))
            writer.add_way(osmium.osm.mutable.Way(id=12,nodes=[9,10,11,12,9],tags={'building':'yes'}))
            writer.add_relation(osmium.osm.mutable.Relation(id=20,members=[('w',10,'outer'),('w',11,'inner')],tags={'type':'multipolygon','building':'residential'}))
            writer.close()
            digest=hashlib.sha256(pbf.read_bytes()).hexdigest()
            subprocess.run([sys.executable,str(SCRIPT),'--input',str(pbf),'--sha256',digest,'--source-url','https://download.geofabrik.de/africa/rwanda-fixture.osm.pbf','--output',str(root/'out')],check=True,capture_output=True)
            folder=root/'out'/'osm-2025-01-01-p2'
            manifest=json.loads((folder/'manifest.json').read_text())
            rows=[]
            for file in folder.glob('*.json.gz'):
                data=gzip.decompress(file.read_bytes()).decode()
                self.assertNotIn('PRIVATE_FIXTURE',data)
                rows.extend(json.loads(data))
            self.assertEqual(len(rows),2)
            self.assertEqual({row[0] for row in rows},{-20,12})
            self.assertEqual(manifest['statistics']['accepted'],2)
            relation=next(row for row in rows if row[0]==-20)
            self.assertEqual(relation[4],2)
            self.assertGreater(relation[3],0)
            lon,lat=relation[1]/1e6,relation[2]/1e6
            self.assertFalse(30.0002<lon<30.0008 and -1.9998<lat<-1.9992)
            failed=subprocess.run([sys.executable,str(SCRIPT),'--input',str(pbf),'--sha256','bad','--source-url','https://download.geofabrik.de/africa/rwanda-fixture.osm.pbf','--output',str(root/'bad')],capture_output=True)
            self.assertNotEqual(failed.returncode,0)
            self.assertFalse((root/'bad').exists())

    def test_standing_disused_buildings_are_unknown_not_missing_houses(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pbf = root / 'lifecycle.osm.pbf'
            header = osmium.io.Header()
            header.set('osmosis_replication_timestamp', '2025-01-01T21:21:00Z')
            writer = osmium.SimpleWriter(str(pbf), header=header)
            tags = [{'building':'house','disused:building':'house'},
                    {'disused:building':'house'}, {'building':'construction'}, {'building':'house'}]
            for index, values in enumerate(tags):
                base = index * 4 + 1
                x = 30 + index * .002
                for n, point in enumerate([(x,-2),(x+.001,-2),(x+.001,-1.999),(x,-1.999)]):
                    writer.add_node(osmium.osm.mutable.Node(id=base+n,location=point))
            for index, values in enumerate(tags):
                base = index * 4 + 1
                writer.add_way(osmium.osm.mutable.Way(id=100+index,nodes=[base,base+1,base+2,base+3,base],tags=values))
            writer.close()
            digest=hashlib.sha256(pbf.read_bytes()).hexdigest()
            subprocess.run([sys.executable,str(SCRIPT),'--input',str(pbf),'--sha256',digest,
                            '--source-url','https://download.geofabrik.de/africa/rwanda-fixture.osm.pbf',
                            '--output',str(root/'out')],check=True,capture_output=True)
            folder=root/'out'/'osm-2025-01-01-p2'
            manifest=json.loads((folder/'manifest.json').read_text())
            rows=[row for f in folder.glob('*.json.gz') for row in json.loads(gzip.decompress(f.read_bytes()))]
            self.assertEqual({row[0]:row[4] for row in rows},{100:0,101:0,103:1})
            self.assertEqual(manifest['processingVersion'],2)
            self.assertEqual(manifest['dataDate'],'2025-01-01T21:21:00Z')
            self.assertEqual(manifest['statistics']['nonExisting'],1)

if __name__=='__main__':
    unittest.main()
