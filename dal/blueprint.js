/* eslint-disable */

import {dal} from 'frontful-dal'
import {Models} from 'frontful-model'

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
@dal.config(() => ({
  url: 'https://hacker-news.firebaseio.com/v0/',
  mapping: {
    top: () => ({
      path: `topstories.json`,
    }),
    item: {
      request: (id) => ({
        path: `item/${id}.json`,
      }),
      parser: (raw) => {
        return raw.slice(0, 4)
      }
    },
  }
}))
@dal.require((context) => ({
  twitter: context.dal.global(Twitter),
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
const models = new Models({
  config: {
    'twitter': {
      token: '0150b91a-a537-4bc9-9026-07c4bd74efe5'
    }
  }
})

// Resolve instance of HackerNews DAL class
const hackerNews = models.global(HackerNews)

// This is long form of accessing resource via path
//const topStories = hackerNews.resolve('topstories.json')

// This is short form of accessing resource via mapping
const topStories = hackerNews.top()

topStories.then((topStories) => {
  hackerNews.retweet(topStories[0])
})
