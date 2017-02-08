# Cryptonite

[![Build Status](https://travis-ci.org/tux-tn/darkwire.io.svg?branch=develop)](https://travis-ci.org/tux-tn/darkwire.io) [![GitHub release](https://img.shields.io/github/release/tux-tn/darkwire.io.svg)]()
***
![Cryptonite](https://i.imgur.com/bXQo19N.png)

Simple ephemeral end-to-end encryption chat. Powered by [socket.io](http://socket.io) and the [web cryptography API](https://developer.mozilla.org/en-US/docs/Web/API/Window/crypto). Based on [darkwire.io](https://github.com/seripap/darkwire.io)
## How it works

Cryptonite uses a combination of asymmetric encryption (RSA-OAEP), symmetric session keys (AES-CBC) and signing keys (HMAC) for security.
Communication between members is powered by [socket.io](https://socket.io) using [WebSocket](https://en.wikipedia.org/wiki/WebSocket) protocol.

## Features

* Login splash screen to give access to authorized users only
* Channel name selector
* Users fingerprint verification using sha256 hashes
* File upload up to 16MB for popular extensions ( jpg, png, doc, csv, txt, zip,...) with full encryption
* Dark and light mode with button toggle
* Easy to use web interface
* Tweet length indicator
* Integration with Chrome for Android
* csrf verification, various security HTTP headers
* Optimized and minified static assets
* Fully localized to French

## Planned Features

- [ ] Fix tests to reflect project changes
- [ ] Password protected channels
- [ ] Private chat between users without channel
- [ ] Encrypt typing and username change events
- [ ] Project Internationalization

## License
Cryptonite is released under the MIT license, copyright for portions of the project are held by [darkwire.io](https://github.com/seripap/darkwire.io)

For more info, have a look here: [https://opensource.org/licenses/MIT](https://opensource.org/licenses/MIT)
