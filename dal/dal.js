import {model, formatter} from 'frontful-model'

function dal(configurator) {
  return dal.config(configurator)
}

dal.require = function(requirer) {
  return function(Dal) {
    Dal.requirer = requirer
    return Dal
  }
}

dal.config = function(configurator) {
  if (!configurator) {
    throw new Error('[frontful-dal] Missing `configurator`')
  }

  return function (Type) {
    function Dal(data, context) {
      if (!context) {
        throw new Error('[frontful-dal] Missing `context`')
      }

      this.context = context

      if (Dal.requirer) {
        Object.assign(this, Dal.requirer.call(this, this.context))
      }

      Object.assign(this, {
        config: configurator.call(this, this.context),
      })

      Type.call(this, data, this.context)
    }

    Dal.prototype = Object.create(Type.prototype)

    Object.assign(Dal.prototype, {
      constructor: Dal,
    })

    return model.format({
      data: formatter.map()
    })(Dal)
  }
}

export {
  dal
}
