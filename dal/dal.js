import {model, formatter} from 'frontful-model'
import {prototype} from './dal.prototype'

function dal(configurator) {
  return dal.config(configurator)
}

dal.define = function(requirer) {
  return function(Dal) {
    Dal.requirer = requirer
    return Dal
  }
}

dal.config = function(configurator) {
  return function (Type) {
    function Dal(data, context) {
      Dal.prototype['initialize.dal'].call(this, data, context, {
        configurator: configurator,
        requirer: Dal.requirer,
      })
      Type.call(this, data, this.context)
    }

    Dal.prototype = Object.create(Type.prototype)
    Dal.prototype.constructor = Dal

    Object.assign(Dal.prototype, prototype)

    return model.format({
      data: formatter.map()
    })(Dal)
  }
}

export {
  dal
}
