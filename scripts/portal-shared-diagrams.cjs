'use strict';
// JPR-004: declared sources only; existing native views and state engines retained.
const C=require('./vendor/portal-diagrams/1.1.1/coverage.cjs');
const config={"graphs": [{"path": ".agents/flow/portal-flow.json", "href": "work.html", "id": "sansu", "title": "Sansuの仕事"}], "sources": [{"path": "docs/product/island-system/current-map.md", "href": "../docs/product/island-system/current-map.md"}, {"path": "docs/product/island-system/growth-proposal.md", "href": "../docs/product/island-system/growth-proposal.md"}], "retained": []};
module.exports={apply:({root,files,...options})=>C.enhance({root,files,...config,...options})};
