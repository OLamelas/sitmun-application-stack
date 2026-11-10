/** Isolated WFS-T fixture; never used by development/production configuration. */
const ns = 'urn:sitmun:e2e:edition';
const endpoint = 'http://127.0.0.1:18093/wfs-edit';
let transactions = 0;
let metadata = 0;
let name = 'original';
const capabilities = `<?xml version="1.0"?>
<WFS_Capabilities version="1.1.0" xmlns="http://www.opengis.net/wfs" xmlns:ows="http://www.opengis.net/ows" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:app="${ns}">
<ows:ServiceIdentification><ows:Title>Edition fixture</ows:Title><ows:ServiceType>WFS</ows:ServiceType><ows:ServiceTypeVersion>1.1.0</ows:ServiceTypeVersion></ows:ServiceIdentification>
<ows:OperationsMetadata>${['GetCapabilities', 'DescribeFeatureType', 'GetFeature', 'Transaction'].map(op => `<ows:Operation name="${op}"><ows:DCP><ows:HTTP><ows:Get xlink:href="${endpoint}"/><ows:Post xlink:href="${endpoint}"/></ows:HTTP></ows:DCP>${op === 'GetFeature' ? '<ows:Parameter name="outputFormat"><ows:Value>application/json</ows:Value></ows:Parameter>' : ''}</ows:Operation>`).join('')}</ows:OperationsMetadata>
<FeatureTypeList><Operations><Operation>Query</Operation><Operation>Insert</Operation><Operation>Update</Operation><Operation>Delete</Operation></Operations><FeatureType><Name>app:roads</Name><Title>Edition fixture</Title><DefaultSRS>urn:ogc:def:crs:EPSG::25831</DefaultSRS><ows:WGS84BoundingBox><ows:LowerCorner>2 41</ows:LowerCorner><ows:UpperCorner>3 42</ows:UpperCorner></ows:WGS84BoundingBox></FeatureType></FeatureTypeList>
</WFS_Capabilities>`;
const schema = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:gml="http://www.opengis.net/gml" xmlns:app="${ns}" targetNamespace="${ns}" elementFormDefault="qualified">
<xsd:import namespace="http://www.opengis.net/gml" schemaLocation="http://schemas.opengis.net/gml/3.1.1/base/gml.xsd"/>
<xsd:complexType name="roadsType"><xsd:complexContent><xsd:extension base="gml:AbstractFeatureType"><xsd:sequence><xsd:element name="geom" type="gml:PointPropertyType" minOccurs="0" nillable="true"/><xsd:element name="name" type="xsd:string" minOccurs="0" nillable="true"/></xsd:sequence></xsd:extension></xsd:complexContent></xsd:complexType>
<xsd:element name="roads" type="app:roadsType" substitutionGroup="gml:_Feature"/></xsd:schema>`;

export function handleWfsEditing(req, res, url) {
  if (url.pathname === '/wfs-edit-stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ transactions, metadata, name })); return true;
  }
  if (url.pathname !== '/wfs-edit') return false;
  const xml = value => { res.writeHead(200, { 'Content-Type': 'text/xml' }); res.end(value); };
  const feature = () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'EPSG:25831' } },
      features: [{ type: 'Feature', id: 'roads.1', geometry: { type: 'Point', coordinates: [422500, 4608500] }, properties: { name } }] }));
  };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 4_194_304) req.destroy(); });
    req.on('end', () => {
      if (!/<(?:\w+:)?Transaction(?:\s|>)/.test(body)) { feature(); return; }
      transactions++;
      const updated = body.match(/<(?:\w+:)?Value[^>]*>([^<]*)<\//);
      if (updated) name = updated[1];
      xml('<wfs:TransactionResponse version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs"><wfs:TransactionSummary><wfs:totalInserted>0</wfs:totalInserted><wfs:totalUpdated>1</wfs:totalUpdated><wfs:totalDeleted>0</wfs:totalDeleted></wfs:TransactionSummary></wfs:TransactionResponse>');
    });
    return true;
  }
  const operation = [...url.searchParams].find(([key]) => key.toLowerCase() === 'request')?.[1]?.toLowerCase();
  if (operation === 'getfeature') feature();
  else { metadata++; xml(operation === 'describefeaturetype' ? schema : capabilities); }
  return true;
}
