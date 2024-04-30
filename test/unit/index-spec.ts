import { expect } from 'chai';
import 'mocha';

import { buildRoutes as buildRoutesExpected } from '../../src/build-routes.js';
import { HandlerBuilder as HandlerBuilderExpected } from '../../src/handler-builder.js';
import { buildRoutes, HandlerBuilder } from '../../src/index.js';

describe('[index]', () => {
    it('should expose the expected modules, functions and properties', async function () {
        expect(HandlerBuilder).to.equal(HandlerBuilderExpected);
        expect(buildRoutes).to.equal(buildRoutesExpected);
    });
});
