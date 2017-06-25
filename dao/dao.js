import {model, formatter} from 'frontful-model'
import {prototype} from './dao.prototype'

function dao(configurator) {
  return dao.config(configurator)
}

dao.define = function(definer) {
  return function(Dao) {
    Dao.__dao_definer__ = definer
    return Dao
  }
}

dao.config = function(configurator) {
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
    })(Dao)

    return Model
  }
}

export {
  dao,
}
