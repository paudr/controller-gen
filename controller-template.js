function recordExists (table) {
  const keyName = table.keys[0].name
  const keyType = table.keys[0].type
  return `private bool RecordExists(${keyType} key)
        {
            return db.${table.name}.Any(p => p.${keyName} == key);
        }`
}

function getSingle (table) {
  const keyName = table.keys[0].name
  const keyType = table.keys[0].type
  return `[EnableQuery]
        public SingleResult<${table.name}> Get([FromODataUri] ${keyType} key)
        {
            IQueryable<${table.name}> result = db.${table.name}.Where(p => p.${keyName} == key);
            return SingleResult.Create(result);
        }`
}

function post (table) {
  const header = `public async Task<IHttpActionResult> Post(${table.name} item)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }`
  const footer = `
            db.${table.name}.Add(item);
            await db.SaveChangesAsync();
            return Created(item);
        }`
  const extra = []
  if (table.created || table.createdBy) extra.push('')
  if (table.created) extra.push(`            item.${table.created} = DateTime.Now;`)
  if (table.createdBy) extra.push(`            item.${table.createdBy} = this.RequestContext.Principal.Identity.Name;`)
  return [header, ...extra, footer].join('\n')
}

function patch (table) {
  const keyType = table.keys[0].type
  const header = `public async Task<IHttpActionResult> Patch([FromODataUri] ${keyType} key, Delta<${table.name}> item)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            var entity = await db.${table.name}.FindAsync(key);
            if (entity == null)
            {
                return NotFound();
            }`
  const footer = `            item.Patch(entity);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!RecordExists(key))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }
            return Updated(entity);
        }`
  const extra = []
  if (table.created) extra.push(`            item.TrySetPropertyValue("${table.created}", entity.${table.created});`)
  if (table.createdBy) extra.push(`            item.TrySetPropertyValue("${table.createdBy}", entity.${table.createdBy});`)
  if (table.modified) extra.push(`            item.TrySetPropertyValue("${table.modified}", DateTime.Now);`)
  if (table.modifiedBy) extra.push(`            item.TrySetPropertyValue("${table.modifiedBy}", this.RequestContext.Principal.Identity.Name);`)
  return [header, ...extra, footer].join('\n')
}

function put (table) {
  const keyName = table.keys[0].name
  const keyType = table.keys[0].type
  const header = `public async Task<IHttpActionResult> Put([FromODataUri] ${keyType} key, ${table.name} update)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            if (key != update.${keyName})
            {
                return BadRequest();
            }`
  const footer = `            db.Entry(update).State = EntityState.Modified;
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!RecordExists(key))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }
            return Updated(update);
        }`
  const extra = []
  if (table.created || table.createdBy) {
    extra.push(`            var entity = await db.${table.name}.AsNoTracking().FirstAsync(p => p.${keyName} == key);`)
  }
  if (table.created) extra.push(`            update.${table.created} = entity.${table.created};`)
  if (table.createdBy) extra.push(`            update.${table.createdBy} = entity.${table.createdBy};`)
  if (table.modified) extra.push(`            update.${table.modified} = DateTime.Now;`)
  if (table.modifiedBy) extra.push(`            update.${table.modifiedBy} = this.RequestContext.Principal.Identity.Name;`)
  return [header, ...extra, footer].join('\n')
}

function deleteItem (table) {
  const keyType = table.keys[0].type
  return `public async Task<IHttpActionResult> Delete([FromODataUri] ${keyType} key)
        {
            var item = await db.${table.name}.FindAsync(key);
            if (item == null)
            {
                return NotFound();
            }
            db.${table.name}.Remove(item);
            await db.SaveChangesAsync();
            return StatusCode(HttpStatusCode.NoContent);
        }`
}

module.exports = function (namespace, entityContainer, table) {
  return `using ${namespace};
using Microsoft.AspNet.OData;
using System;
using System.Data.Entity;
using System.Data.Entity.Infrastructure;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using System.Web.Http;

namespace catalegbi_api.Controllers
{
    public class ${table.name}Controller : ODataController
    {
        readonly ${entityContainer} db = new ${entityContainer}();

        ${recordExists(table)}

        protected override void Dispose(bool disposing)
        {
            db.Dispose();
            base.Dispose(disposing);
        }

        [EnableQuery]
        public IQueryable<${table.name}> Get()
        {
            return db.${table.name};
        }

        ${getSingle(table)}

        ${post(table)}

        ${patch(table)}

        ${put(table)}

        ${deleteItem(table)}
    }
}
`
}
