/* eslint-disable */

import {dal} from 'frontful-dal'

// --- twitter.js Twitter DAL ---

// `config()` is uesed to configure DAL e.g. to specify url and base headers
@dal.config((context) => ({
  url: 'https://api.twitter.com/1.1/',
  headers: {
    Authorization: `OAuth
      oauth_token="${context.config['twitter'].token}"
    `,
  },
}))
export class Twitter {
  // Create more descriptive and specialised method for posting status updates
  // This could be seen as more declaritive way of calling `post(...)` directly
  tweet(status) {
    // `@dal` provides basic methods such as `resolve`, `get`, `post`, `put` and `delete` on `this`
    return this.post(`statuses/update.json?status=${encodeURIComponent(status)}`)
  }
}

// --- hackernews.js HackerNews DAL ---

// `dal.require()` is uesed to require external to curent DAL dependencies
@dal.require((context) => ({
  twitter: context.dal.global(Twitter),
}))
@dal.config(() => ({
  url: 'https://hacker-news.firebaseio.com/v0/',
}))
export class HackerNews {
  retweet(itemId) {
    return this.resolve(`item/${itemId}.json`).then((item) => {
      return this.twitter.tweet(`${item.title}\n${item.url}`)
    })
  }
}

// --- app.js DAL usage ---
// Get top stories fron HackerNews and retweet the most-toppest-one

// Create dal instances for current request or browser session
const dal = new Dal({
  config: {
    'twitter': {
      token: 'whatewer'
    }
  }
})

const hackerNews = dal.global(HackerNews)
const topStories = hackerNews.resolve('topstories.json')
hackerNews.retweet(topStories[0])

// TODO: Incorporate models or make DALs as superset of models for serialization purpouses
