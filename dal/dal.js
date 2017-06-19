import {model, formatter} from 'frontful-model'
import {prototype} from './dal.prototype'

function dal(configurator) {
  return dal.config(configurator)
}

dal.define = function(definer) {
  return function(Dal) {
    Dal.__dal_definer__ = definer
    return Dal
  }
}

dal.config = function(configurator) {
  return function (Type) {
    let Model

    function Dal(data, context) {
      Dal.prototype['initialize.dal'].call(this, data, context, {
        configurator: configurator,
        definer: Model.__dal_definer__,
      })
      Type.call(this, data, this.context)
    }

    Dal.prototype = Object.create(Type.prototype)
    Dal.prototype.constructor = Dal

    Object.assign(Dal.prototype, prototype)

    Model = model.format({
      data: formatter.map()
    })(Dal)

    return Model
  }
}

export {
  dal
}
