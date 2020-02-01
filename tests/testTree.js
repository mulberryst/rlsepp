const TreeModel = require('tree-model'),
  JSON = require('JSON')
;

let tree = new TreeModel()
let wallet = {'USD': 0}
let ledgerRoot = tree.parse({id:'1', wallet: wallet})
if (typeof ledgerRoot.model === 'undefined')
  console.log('new')
console.log(JSON.stringify(tree, null, 4))

