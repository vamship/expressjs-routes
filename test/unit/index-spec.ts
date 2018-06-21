import { expect } from 'chai';
import 'mocha';
import buildRoutesExpected from '../../src/build-routes';
import HandlerBuilderExpected from '../../src/handler-builder';
import { HandlerBuilder, buildRoutes } from '../../src/index';

describe('[index]', () => {
    it('should expose the expected modules, functions and properties', () => {
        expect(HandlerBuilder).to.equal(HandlerBuilderExpected);
        expect(buildRoutes).to.equal(buildRoutesExpected);
    });
});
