# Express Routes

_Enable declarative configuration and mounting of
[expressjs](https://expressjs.com) routes._

This library exposes classes and methods that allow the definition of expressjs
routes as distinct processing steps, making it easy to test the individual steps,
and also allowing for declarative route definitions for the server.

## API Documentation

API documentation can be found
[here](https://vamship.github.io/expressjs-routes).

## Motivation

When creating routes on a web server such as expressjs, it is advantageous from
a testing and configuration perspective to split the processing of the http
request into discrete blocks. When broken out in this way, each request can be
seen as being sent through a chain of processing blocks, each performing an
action, and passing its output on the next block.

This approach not only allows each block to be tested individually, but also
allows the creation of declarative route definitions. Each route can be defined
as a collection of blocks, specified declaratively. These definitions, can in
turn be parsed by the server at start up time, creating the actual routes that
will be supported.

This module takes the approach of breaking the processing pipeline into four
distinct blocks:

1.  **Input Mapping**: Convert the raw HTTP request into a simple javascript
    object that can be validated and processed by downstream blocks
2.  **Schema Validation**: This is an optional block that can be used to ensure
    that the mapped input has the expected properties set on it.
3.  **Request Processing**: This accepts a javscript object from the input
    mapping, and returns the response object that forms the response to the
    client. The return from this block can also be a promise that eventually
    resolves to the final response.
4.  **Output Mapping**: Convert the response from the request processing step
    into an HTTP response that will be sent to the client.

## Installation

This library can be installed using npm:

```
npm install @vamship/expressjs-routes
```

## Usage

This library has been developed in typescript, and exports type declarations
for applications developed using typescript. Read the API documentation for
more details.

### Construct individual routes

The core export from this library is a `HandlerBuilder` class that can be used
to build out a route handler that conforms to expressjs' route handler
signature. Individual routes can be built as follows:

```javascript
const HandlerBuilder = require('@vamship/expressjs-routes');
const express = require('express');

// This will be used in logs, use the path/method to make it meaningful
const handlerName = 'GET /:greeting/:name';

const greetingHandler = ({ greeting, name }) => {
    return { message: `${greeting}, ${name}` };
};

// The input mapper can either be a function or a map of properties to
// the corresponding values in the expressjs request.
const inputMapper = (req) => {
    return {
        name: req.params.name,
        greeting: req.params.greeting
    };
};

const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    description: 'Schema for greet user API',
    properties: {
        greeting: { type: 'string', enum: ['hello', 'hola', 'bonjour' ] },
        name: { type: 'string', minLength: 1 }
    },
    required: ['name', 'greeting']
};

const outputMapper = (data, res, next) => {
    res.json(data);
};

const builder = new HandlerBuilder(handlerName, greetingHandler)
                    .setInputMapper(inputMapper)
                    .setSchema(schema)
                    .setOutputMapper(outputMapper);
const handler = builder.build();

    ...

const app = express();
app.get('/:greeting/:name', handler);

    ...
```

### Construct routers using declarative definitions

While the above steps can be used to construct individual routes, a utility
method `buildRoutes` has been provided to construct a set of routes using
declarative route definitions as follows:

```javascript
const { buildRoutes } = require('@vamship/expressjs-routes');
const express = require('express');

const routeDefinitions = [{
    method: 'GET',
    path: '/:greeting/:name',
    handler: ({ greeting, name }) => ({ message: `${greeting}, ${name}` }),
    // Use mapping instead of function
    inputMapper:{
        name: 'params.name',
        greeting: 'params.greeting'
    },
    // No schema validation (not really a good idea)
    schema: undefined,

    // Uses the default, which basically calls res.json(data);
    outputMapper: undefined
}];

const app = express();

// Construct a router using the route definitions, and return the
// resulting router object
const router = buildRoutes(routeDefinitions);

// Mount the routes under a path called /greeting-api
app.use('/greeting-api', router);

...
```

## A Note on Typescript

This library has been developed using typescript, and exports type declarations
for the different classes. Since typescript is transpiled into javascript, this
library can also be used in applications built using javascript.

A word of caution, however - this library does not perform explicit argument
type checks in code, and relies on typescript's strong type system to enforce
input argument types. Because plain javascript does not have a type system,
using the apis and methods exposed by this library in javascript can lead to
confusing errors if the input arguments are not of the correct type, or do not
expose the expected properties.

This is not a new or ground breaking idea, but it is prudent to be reminded of
it. Read the API documentation carefully :).
