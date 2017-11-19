import {model, formatter} from 'frontful-model'
import {prototype} from './dao.prototype'

function dao(configurator, identifier) {
  return dao.config(configurator, identifier)
}

dao.define = function(definer) {
  return function(Dao) {
    Dao.__dao_definer__ = definer
    return Dao
  }
}

dao.config = function(configurator, identifier) {
  return function (Type) {
    let Model

    function Dao(data, context) {
      Dao.prototype['initialize.dao'].call(this, data, context, {
        configurator: configurator,
        definer: Model.__dao_definer__,
      })
      Type.call(this, data, this.context)
    }

    Dao.prototype = Object.create(Type.prototype)
    Dao.prototype.constructor = Dao

    Object.assign(Dao.prototype, prototype)

    Model = model.format({
      data: formatter.map()
    }, identifier)(Dao)

    return Model
  }
}

export {
  dao,
}
