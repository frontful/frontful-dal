import fetch from 'isomorphic-fetch'
import deepExtend from 'deep-extend'
import deepEqual from 'deep-equal'
import jsonStableStringify from 'json-stable-stringify'

const urlParts = /(^.*?(?=\?|#|$))(\?.*?(?=#|$))?(#.*?(?=$))?/i

function normalizePath(path) {
  let {1: pathname, 2: query, 3:fragment} = path.match(urlParts)
  query = query ? `?${query.substring(1).split('&').sort().join('&')}` : ''
  fragment = fragment ? `#${fragment.substring(1).split('&').sort().join('&')}` : ''
  return `${pathname}${query}${fragment}`
}

function defaultParser(json) {
  return json
}

defaultParser.type = 'json'

const prototype = {
  'initialize.dal'(data, context, {configurator, requirer}) {
    if (!context) {
      throw new Error('[frontful-dal] Missing `context`')
    }

    if (!configurator) {
      throw new Error('[frontful-dal] Missing `configurator`')
    }

    this.context = context

    if (requirer) {
      Object.assign(this, requirer.call(this, this.context))
    }

    const {url, mapping, parser, ...options} = configurator.call(this, this.context)

    this.url = url
    this.options = deepExtend({
      parser: parser || defaultParser,
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }, options)

    if (mapping) {
      Object.assign(this, this['initialize.mapping'](mapping))
    }
  },

  'initialize.mapping'(mapping, name = '') {
    const keys = Object.keys(mapping)
    return keys.map((key) => (
      this['initialize.mapping.item'](mapping[key], name ? `${name}.${key}` : key)
    ))
  },

  'initialize.mapping.item'(item, name) {
    if (typeof item === 'string') {
      const path = item
      item = {
        options: () => ({
          path: path
        })
      }
    }
    else if (typeof item === 'function') {
      const options = item
      item = {
        options: options
      }
    }

    if (item.hasOwnProperty('options')) {
      function method(...args) {
        return method.resolve(...args)
      }

      let parser = null

      if (item.response) {
        parser = item.response
        parser.type = 'response'
      }
      else if (item.json) {
        parser = item.json
        parser.type = 'json'
      }
      else if (item.text) {
        parser = item.text
        parser.type = 'text'
      }

      method.get = method.update = (...args) => {
        const {path, ...options} = item.options(...args)
        options.name = name
        options.parser = parser
        return this.get(path, options)
      }

      method.resolve = (...args) => {
        const {path, ...options} = item.options(...args)
        options.name = name
        options.parser = parser
        return this.resolve(path, options)
      }

      return method
    }
    else {
      return this['initialize.mapping'](item, name)
    }
  },

  memoize({method, path, body}, request) {
    this.memoized = this.memoized || {}
    this.memoized[method] = this.memoized[method] || {}
    this.memoized[method][path] = this.memoized[method][path] || []

    const index = this.memoized[method][path].push({body, request}) - 1

    request.then(() => {
      this.memoized[method][path].splice(index, 1)
      return null
    }).catch((error) => {
      this.memoized[method][path].splice(index, 1);
      throw error
    })

    return request
  },

  memoized({method, path, body}) {
    if (this.memoized && this.memoized[method] && this.memoized[method][path] && this.memoized[method][path].length > 0) {
      for (let i = 0, l = this.memoized[method][path].length; i < l; i++) {
        const object = this.memoized[method][path][i]
        if (object.body === body || (typeof object.body === 'object' && typeof body === 'object' && deepEqual(object.body, body))) {
          return object.request
        }
      }
    }
    return null
  },

  request(path, body, options) {
    const normalPath = normalizePath(path)
    const url = `${this.config.url}${normalPath}`
    const {parser, name, ...fetchOptions} = deepExtend({}, this.options, options)

    fetchOptions.method = fetchOptions.method.toUpperCase()

    if (fetchOptions.method !== 'GET') {
      const bodyStr = jsonStableStringify(body)
      fetchOptions.body = bodyStr && bodyStr.replace(/[\u007F-\uFFFF]/gm, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).substr(-4))
    }

    const memoizeKey = {
      method: fetchOptions.method,
      path: normalPath,
      body: fetchOptions.body,
    }

    return this.memoized(memoizeKey) || this.memoize(memoizeKey, Promise.resolve(
      fetch(url, fetchOptions)).then((response) => {
        if (parser.type === 'json' || parser.type === 'text') {
          return response[parser.type]().then(parser)
        }
        else {
          return parser(response)
        }
      }).then((parsed) => {
        if (fetchOptions.method === 'GET') {
          this.data.set(`${name}:${normalPath}`, parsed)
        }
        return parsed
      })
    )
  }
}

export {
  prototype
}