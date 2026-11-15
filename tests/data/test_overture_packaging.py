"""Offline immutable-asset contracts; no network or third-party Python modules."""
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('overture_package', Path(__file__).parents[2] / 'scripts/package-overture.py')
module = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class PackagingTest(unittest.TestCase):
    def test_full_geometry_hashes_and_deterministic_bounded_workers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'input'
            root.mkdir()
            metadata = {'release': '2026-09-23.1', 'license': 'ODbL-1.0', 'attribution': 'Fixture',
                        'statistics': {'accepted': 1}, 'countryMask': {}, 'countryMaskSha256': 'fixture',
                        'queryFiles': [], 'sourceCounts': {}, 'useClasses': {}}
            (root / 'manifest.json').write_text(json.dumps(metadata))
            connection = sqlite3.connect(root / 'minimized.sqlite')
            connection.execute('CREATE TABLE buildings(id TEXT PRIMARY KEY,x INT,y INT,lon INT,lat INT,area INT,use INT,source INT,confidence INT,geometry TEXT)')
            outline = ['Polygon', [[[30, -2], [30.001, -2], [30.001, -1.999], [30, -2]]]]
            x, y = module.tile(30000500, -1999800, 12)
            source_id = '00000000-0000-0000-0000-000000000001'
            connection.execute('INSERT INTO buildings VALUES(?,?,?,?,?,?,?,?,?,?)', (source_id, x, y, 30000500, -1999800, 50, 0, 2, 80, json.dumps(outline)))
            connection.commit()
            output = Path(directory) / 'objects-one'
            second = Path(directory) / 'objects-two'
            module.package(root, output, 1)
            module.package(root, second, 2)
            filename = 'overture-2026-09-23.1-p1.json'
            first_manifest = json.loads((output / filename).read_text())
            self.assertEqual((output / filename).read_bytes(), (second / filename).read_bytes())
            self.assertEqual({p.name for p in (output / 'objects').iterdir()}, {p.name for p in (second / 'objects').iterdir()})
            # Same ID, representative and area do not prove unchanged geometry.
            outline[1][0][1][0] += .00001
            connection.execute('UPDATE buildings SET geometry=?', (json.dumps(outline),))
            connection.commit()
            metadata['release'] = '2026-10-21.0'
            (root / 'manifest.json').write_text(json.dumps(metadata))
            module.package(root, output, 2)
            revised = json.loads((output / 'overture-2026-10-21.0-p1.json').read_text())
            self.assertEqual(first_manifest['tiles'], revised['tiles'])
            self.assertNotEqual(first_manifest['outlineTiles'], revised['outlineTiles'])
            self.assertEqual(len(list((output / 'objects').iterdir())), 3)
            connection.execute('UPDATE buildings SET geometry=?', (json.dumps(['LineString', [[30, -2], [30.01, -2]]]),))
            connection.commit()
            metadata['release'] = '2026-11-18.0'
            (root / 'manifest.json').write_text(json.dumps(metadata))
            with self.assertRaisesRegex(ValueError, 'Unexpected building geometry'):
                module.package(root, output, 1)
            self.assertFalse((output / 'overture-2026-11-18.0-p1.json').exists())
            connection.close()


if __name__ == '__main__':
    unittest.main()
