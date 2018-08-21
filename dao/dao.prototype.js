import deepEqual from 'deep-equal'
import deepExtend from 'deep-extend'
import fetch from 'isomorphic-fetch'
import jsonStableStringify from 'json-stable-stringify'
import {HttpError} from './HttpError'

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
  'initialize.dao'(data, context, {configurator, definer}) {
    if (!context) {
      throw new Error('[frontful-dao] Missing `context`')
    }

    if (!configurator) {
      throw new Error('[frontful-dao] Missing `configurator`')
    }

    this.context = context

    if (definer) {
      Object.assign(this, definer.call(this, this.context))
    }

    const {url, mapping, parser, ...options} = configurator.call(this, this.context)

    this.url = url
    this.options = deepExtend({
      parser: parser || defaultParser,
      method: 'GET',
      mode: 'cors',
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
    return keys.reduce((result, key) => {
      result[key] = this['initialize.mapping.item'](mapping[key], name ? `${name}.${key}` : key)
      return result
    }, {})
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

      let parser = defaultParser

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

  memoize({method, path, body}, request, shouldMemoize) {
    if (shouldMemoize) {
      this.memoized = this.memoized || {}
      this.memoized[method] = this.memoized[method] || {}
      this.memoized[method][path] = this.memoized[method][path] || []

      const index = this.memoized[method][path].push({body, request}) - 1

      request.then(() => {
        this.memoized[method][path].splice(index, 1)
      }).catch(() => {
        this.memoized[method][path].splice(index, 1);
      })
    }

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

  resolve(path, options) {
    const key = `${(options && options.name) ? `${options.name}:` : ''}${normalizePath(path)}`
    if (this.data.has(key)) {
      return Promise.resolve(this.data.get(key))
    }
    else {
      return this.get(path, options)
    }
  },

  get(path, options) {
    return this.request(path, null, {
      ...options,
      method: 'GET'
    })
  },
  post(path, body, options) {
    return this.request(path, body, {
      ...options,
      method: 'POST'
    })
  },
  put(path, body, options) {
    return this.request(path, body, {
      ...options,
      method: 'PUT'
    })
  },
  delete(path, body, options) {
    return this.request(path, body, {
      ...options,
      method: 'DELETE'
    })
  },

  request(path, body, options, retryCount) {
    const normalPath = normalizePath(path)
    let url = `${this.url}${normalPath}`
    if (/^https?:\/\/|^\/\//i.test(normalPath)) {
      url = normalPath
    }

    const {parser, name, ...fetchOptions} = deepExtend({}, this.options, options)

    fetchOptions.method = fetchOptions.method.toUpperCase()

    if (fetchOptions.method !== 'GET' && body && !fetchOptions.body) {
      const bodyStr = jsonStableStringify(body)
      fetchOptions.body = bodyStr && bodyStr.replace(/[\u007F-\uFFFF]/gm, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).substr(-4))
    }

    const memoizeKey = {
      method: fetchOptions.method,
      path: normalPath,
      body: fetchOptions.body,
    }

    const parse = (response) => {
      if (parser.type === 'json' || parser.type === 'text') {
        return response[parser.type]().then(parser)
      }
      else {
        return Promise.resolve(parser(response))
      }
    }

    const shouldMemoize = !retryCount

    return (shouldMemoize && this.memoized(memoizeKey)) || this.memoize(memoizeKey, Promise.resolve(
      fetch(url, fetchOptions)).then((response) => {
        if (response.status === 204) {
          return null
        }
        else if (response.status >= 400) {
          let _response = response.clone()
          return parse(response)
            .catch(() => _response.text())
            .catch(() => null)
            .then((parsed) => {
              _response = null
              throw new HttpError(response, parsed)
            })
        }
        else {
          return parse(response)
        }
      }).then((parsed) => {
        if (fetchOptions.method === 'GET') {
          this.data.set(`${name ? `${name}:` : ''}${normalPath}`, parsed)
        }
        return parsed
      }).catch((error) => {
        if (fetchOptions.onError) {
          retryCount = retryCount || 0
          return Promise.resolve(fetchOptions.onError.call(this, error, retryCount, fetchOptions.onErrorFail)).then(() => {
            return this.request(path, body, options, retryCount + 1)
          })
        }
        throw error
      }), shouldMemoize
    )
  }
}

export {
  prototype
}
