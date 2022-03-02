const path = require('path')
const fs = require('fs/promises')
const xml2js = require('xml2js')
const controllerTemplate = require('./controller-template.js')

async function getEDMXFileName (dirpath) {
  const modelFolderFiles = await fs.readdir(path.join(dirpath))
  return modelFolderFiles.find(name => /\.edmx$/.test(name))
}

async function readEDMX (solutionPath) {
  const modelPath = path.join(solutionPath, 'Models')
  const modelFile = await getEDMXFileName(modelPath)
  const modelFileContent = await fs.readFile(path.join(modelPath, modelFile))
  return await xml2js.parseStringPromise(modelFileContent.toString())
}

async function readNamespace (solutionPath) {
  const modelPath = path.join(solutionPath, 'Models')
  const modelFile = await getEDMXFileName(modelPath)
  const modelName = modelFile.substring(0, modelFile.length - 5)
  const contextFilePath = path.join(modelPath, `${modelName}.Context.cs`)
  const contextFile = await fs.readFile(contextFilePath)
  return contextFile.toString().match(/^namespace (.*)$/m)?.[1]
}

function getTables (edmx) {
  const entityTypes = edmx['edmx:Edmx']['edmx:Runtime'][0]['edmx:ConceptualModels'][0].Schema[0].EntityType
  return entityTypes.map(entityType => ({
    name: entityType.$.Name,
    keys: entityType.Key.map(key => {
      const name = key.PropertyRef[0].$.Name
      const type = entityType.Property.find(prop => prop.$.Name === name).$.Type
      return { name, type }
    }),
    created: entityType.Property.find(prop => prop.$.Name.toUpperCase() === 'CREATED')?.$.Name,
    createdBy: entityType.Property.find(prop => prop.$.Name.toUpperCase() === 'CREATEDBY')?.$.Name,
    modified: entityType.Property.find(prop => prop.$.Name.toUpperCase() === 'MODIFIED')?.$.Name,
    modifiedBy: entityType.Property.find(prop => prop.$.Name.toUpperCase() === 'MODIFIEDBY')?.$.Name
  }))
}

async function createController (solutionPath, namespace, entityContainer, table) {
  const content = controllerTemplate(namespace, entityContainer, table)
  const filePath = path.join(solutionPath, 'Controllers', `${table.name}Controller.cs`)
  await fs.writeFile(filePath, content)
}

module.exports = async function ControllerGen (solutionPath) {
  const edmx = await readEDMX(solutionPath)
  const namespace = await readNamespace(solutionPath)
  const entityContainer = edmx['edmx:Edmx']['edmx:Runtime'][0]['edmx:ConceptualModels'][0].Schema[0].EntityContainer[0].$.Name
  const tables = getTables(edmx)

  for (const table of tables) {
    await createController(solutionPath, namespace, entityContainer, table)
    console.log(`builder.EntitySet<${table.name}>("${table.name}");`)
  }
}
