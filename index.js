/*
 * Proof of concept; example code for generating a snapshot of a custom style
 */
let URL = require('url');
let sharp = require('sharp');
let fs = require('fs');
let path = require('path');
//let mbgl = require('@mapbox/mapbox-gl-native');
let mbgl = require('@acalcutt/maplibre-gl-native');
let request = require('request');

let access_token = 'ma';

let kinds = {
  Unknown: 0,
  Style: 1,
  Source: 2,
  Tile: 3,
  Glyphs: 4,
  SpriteImage: 5,
  SpriteJSON: 6
};

// next few stanzas copied from mapbox-gl-js/src/util/mapbox.js
let config = {
  API_URL: 'https://api.mapbox.com',
  REQUIRE_ACCESS_TOKEN: true,
  ACCESS_TOKEN: access_token,
};

function formatUrl(obj) {
    const params = obj.params.length ? `?${obj.params.join('&')}` : '';
    return `${obj.protocol}://${obj.authority}${obj.path}${params}`;
}

function makeAPIURL(urlObject, accessToken) {
    const apiUrlObject = parseUrl(config.API_URL);
    urlObject.protocol = apiUrlObject.protocol;
    urlObject.authority = apiUrlObject.authority;

    if (apiUrlObject.path !== '/') {
        urlObject.path = `${apiUrlObject.path}${urlObject.path}`;
    }

    if (!config.REQUIRE_ACCESS_TOKEN) return formatUrl(urlObject);

    accessToken = accessToken || config.ACCESS_TOKEN;
    if (!accessToken)
        throw new Error(`An API access token is required to use Mapbox GL. ${help}`);
    if (accessToken[0] === 's')
        throw new Error(`Use a public access token (pk.*) with Mapbox GL, not a secret access token (sk.*). ${help}`);

    urlObject.params.push(`access_token=${accessToken}`);
    return formatUrl(urlObject);
}

function isMapboxURL(url) {
    return url.indexOf('mapbox:') === 0;
}

const urlRe = /^(\w+):\/\/([^/?]*)(\/[^?]+)?\??(.+)?/;

function parseUrl(url) {
    const parts = url.match(urlRe);
    if (!parts) {
        throw new Error('Unable to parse URL object');
    }
    return {
        protocol: parts[1],
        authority: parts[2],
        path: parts[3] || '/',
        params: parts[4] ? parts[4].split('&') : []
    };
}

// adapted from functions in mapbox-gl-js/src/util/mapbox.js
function normalizeURL(url, kind) {
  const urlObject = parseUrl(url);
  if (kind == kinds.Style) {
    if (!isMapboxURL(url)) { return url; }
    urlObject.path = `/styles/v1${urlObject.path}`;
    return makeAPIURL(urlObject, access_token);
  }
  if (kind == kinds.Tile) {
    if (!isMapboxURL(url)) { return url; }
    urlObject.path = `/v4${urlObject.path}`;
    // TODO: use {a,b,c}.tiles.mapbox.com as authority
    return makeAPIURL(urlObject, access_token);
  }
  if (kind == kinds.Glyphs) {
    if (!isMapboxURL(url)) { return url; }
    urlObject.path = `/fonts/v1${urlObject.path}`;
    return makeAPIURL(urlObject, access_token);
  }
  if (kind == kinds.Source) {
    if (!isMapboxURL(url)) { return url; }
    urlObject.path = `/v4/${urlObject.authority}.json`;
    urlObject.params.push('secure');
    return makeAPIURL(urlObject, access_token);
  }
  if (kind == kinds.SpriteJSON || kind == kinds.SpriteImage) {
    // TODO: use ratio to add @2x?
    if (!isMapboxURL(url)) { return url; }
    let parts = urlObject.path.split('.');
    urlObject.path = `/styles/v1${parts[0]}/sprite.${parts[1]}`;
    return makeAPIURL(urlObject);
  }
}

let options = {
  request: function(req, callback) {
    let fqurl = normalizeURL(req.url, req.kind);
    if (fqurl.indexOf('file://') === 0) {
      return fs.readFile(fqurl.slice(7), function (err, data) {
        if (err) return callback(err);
        let response = {};
        response.data = data;
        return callback(null, response);
      })
    }
    
    request({
      url: fqurl,
      encoding: null,
      gzip: true
    }, function(err, res, body) {
      if (err) {
        callback(err);
      }
      else if (res.statusCode == 200) {
        let response = {};

        if (res.headers.modified) { response.modified = new Date(res.headers.modified); }
        if (res.headers.expires) { response.expires = new Date(res.headers.expires); }
        if (res.headers.etag) { response.etag = res.headers.etag; }

        response.data = body;

        callback(null, response);
      }
      else {
        callback(new Error(JSON.parse(body).message));
      }
    });
  },
  ratio: 1, // pixel density, i.e. 1 = 1x, 2 = 2x, 3 = 3x
  mode: 'tile',
};

let map = new mbgl.Map(options);
let map2 = new mbgl.Map(options);

// TODO: create server
// parameters: trip geojson
// add request caching
// how to change trip source data?

request('https://tiles.wifidb.net/styles/WDB_OSM/style.json', function(err, res, body) {
  if (err) throw err;
  if (res.statusCode == 200) {
    let style = JSON.parse(body);
    
    // MODIFY STYLE HERE if desired
	
	
    
    map.load(style);
    let render_options = {
      zoom: 8,
      width: 512,
      height: 512,
      center: [ -73.8298, 42.5512 ],
      bearing: 0,
      pitch: 0,
    };

    map.render(render_options, function(err, buffer) {
      if (err) throw err;

      let image = sharp(buffer, {
        raw: {
          width: 512,
          height: 512,
          channels: 4,
        },
      });

      image.toFile('1.png', function(err) {
        if (err) throw err;
      });

    });
	
    map2.load(style);
    let render_options2 = {
      zoom: 8,
      width: 512,
      height: 512,
      center: [ -72.4238, 42.5512 ],
      bearing: 0,
      pitch: 0,
    };

    map2.render(render_options2, function(err, buffer) {
      if (err) throw err;

      let image2 = sharp(buffer, {
        raw: {
          width: 512,
          height: 512,
          channels: 4,
        },
      });

      image2.toFile('2.png', function(err) {
        if (err) throw err;
      });

    });
  }
});