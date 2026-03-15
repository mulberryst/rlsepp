const TreeModel = require('tree-model'),
  JSON = require('JSON'),
	log = require('ololog')
;

let tree = new TreeModel({modelComparatorFn: (a, b) => {a.index - b.index}})
let wallet = {'USD': 0}
let ledgerRoot = tree.parse({id:'1', wallet: wallet})
console.log(JSON.stringify(ledgerRoot, null, 4))
if (typeof ledgerRoot.model === 'undefined')
  console.log('new')

log(ledgerRoot)

if (ledgerRoot.isRoot()) console.log('its root')

let obj = {id:'2', wallet: wallet}
ledgerRoot.addChild(tree.parse(obj))
log(ledgerRoot)

//ledgerRoot.all(console.log(
    for (let node of ledgerRoot.all(function (node) {
//    return node.model.id >= level && node.model.action.action == "sell"
//    return !node.hasChildren() && node.model.action && node.model.action.action == "sell"
    return !node.hasChildren() && node.model
  })) {
      let path = node.getPath()
//	console.log(path)
	console.log(node.model.id)
}


//console.log(JSON.stringify(ledgerRoot, null, 4))
