import ExtendableError from 'es6-error'

class HttpError extends ExtendableError {
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
