import ExtendableError from 'es6-error'

class HttpError extends ExtendableError {
  static create(response, parsed) {
    if (parsed) {
      return Promise.resolve(new HttpError(response, parsed))
    }
    else {
      return response.text().catch(() => null).then((parsed) => new HttpError(response, parsed))
    }
  }

  constructor(response, parsed) {
    const message = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
    super(`${response.status}; ${message}`)
    this.response = response
    this.parsed = parsed
  }
}

export {
  HttpError,
}
