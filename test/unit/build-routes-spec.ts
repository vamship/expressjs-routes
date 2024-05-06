import { expect, use as _useWithChai } from 'chai';
import _sinonChai from 'sinon-chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import process from 'process';

_useWithChai(_sinonChai);
_useWithChai(_chaiAsPromised);

import { stub, spy } from 'sinon';
import _esmock from 'esmock';
import { Router } from 'express';
import {
    ObjectMock,
    MockImportHelper,
    testValues as _testValues,
} from '@vamship/test-utils';

import { JSONSchemaType } from 'ajv';
import { buildRoutes } from '../../src/build-routes.js';
import { HandlerBuilder } from '../../src/handler-builder.js';
import { IRouteDefinition } from '../../src/handler-types.js';

describe('buildRoutes()', function () {
    const HTTP_METHODS = [
        'all',
        'get',
        'put',
        'post',
        'delete',
        'patch',
        'options',
    ];
    type ImportResult = {
        testTarget: typeof buildRoutes;
        handlerBuilderMock: ObjectMock<HandlerBuilder>;
        routerMock: ObjectMock<Router>;
    };

    async function _import(): Promise<ImportResult> {
        const handlerBuilderMock: ObjectMock<HandlerBuilder> =
            new ObjectMock<HandlerBuilder>();

        handlerBuilderMock
            .addMock('setInputMapper', () => handlerBuilderMock.instance)
            .addMock('setSchema', () => handlerBuilderMock.instance)
            .addMock('setOutputMapper', () => handlerBuilderMock.instance)
            .addMock('build', () => stub());

        const routerMock = new ObjectMock<Router>();
        HTTP_METHODS.reduce(
            (result, method) => result.addMock(method, stub()),
            routerMock,
        );

        type BuildRoutesModule = {
            buildRoutes: typeof buildRoutes;
        };
        const importHelper = new MockImportHelper<BuildRoutesModule>(
            'project://src/build-routes.js',
            {
                express: 'express',
                handlerBuilder: 'project://src/handler-builder.js',
            },
            import.meta.resolve('../../../working'),
        );

        importHelper.setMock('express', {
            Router: routerMock.ctor,
        });
        importHelper.setMock('handlerBuilder', {
            HandlerBuilder: handlerBuilderMock.ctor,
        });

        const targetModule = await _esmock(
            importHelper.importPath,
            importHelper.getLibs(),
            importHelper.getGlobals(),
        );

        return {
            testTarget: targetModule.buildRoutes,
            handlerBuilderMock,
            routerMock,
        };
    }

    function _createRouteDefinitions(
        count = 1,
        options?: Record<string, unknown>,
    ): IRouteDefinition[] {
        const routes: IRouteDefinition[] = [];

        for (let index = 0; index < count; index++) {
            routes.push({
                name: _testValues.getString('handlerName'),
                method: HTTP_METHODS[index % HTTP_METHODS.length],
                path: `/${_testValues.getString(
                    'foo',
                )}/:${_testValues.getString('bar')}`,
                inputMapper: stub().returns({}),
                schema: {} as JSONSchemaType<unknown>,
                outputMapper: spy(),
                handler: stub().returns({}),
                ...options,
            });
        }
        return routes;
    }

    it('should return an express js router when invoked', async function () {
        const { testTarget: buildRoutes, routerMock } = await _import();
        const definitions = _createRouteDefinitions(10);
        const ret = buildRoutes(definitions);

        expect(ret).to.equal(routerMock.instance);
    });

    it('should create an expressjs router object if no router was specified', async function () {
        const { testTarget: buildRoutes, routerMock } = await _import();
        const definitions = _createRouteDefinitions(10);
        const routerCtor = routerMock.ctor;

        expect(routerCtor).to.not.have.been.called;

        buildRoutes(definitions);

        expect(routerCtor).to.have.been.calledOnce;
    });

    it('should not create an expressjs router object if a router was specified', async function () {
        const { testTarget: buildRoutes, routerMock } = await _import();
        const definitions = _createRouteDefinitions(10);
        const routerCtor = routerMock.ctor;

        expect(routerCtor).to.not.have.been.called;

        buildRoutes(definitions, routerMock.instance);

        expect(routerCtor).to.not.have.been.called;
    });

    ['bad', 'worse'].forEach((method) => {
        it(`should throw an error if the route specifies an invalid HTTP method (value=${method})`, async function () {
            const { testTarget: buildRoutes } = await _import();
            const definitions = _createRouteDefinitions(1, {
                method,
            });
            const error = `Unsupported HTTP method: ${method} for route ${definitions[0].name}`;
            const wrapper = () => buildRoutes(definitions);

            expect(wrapper).to.throw(error);
        });
    });

    it('should not mount any routes on to the router if the route definition list is empty', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const definitions: IRouteDefinition[] = [];

        const routerCtor = routerMock.ctor;
        const setInputMapperMethod = handlerBuilderMock.mocks.setInputMapper;
        const setSchemaMethod = handlerBuilderMock.mocks.setSchema;
        const setOutputMapperMethod = handlerBuilderMock.mocks.setOutputMapper;

        expect(routerCtor).to.not.have.been.called;
        expect(handlerBuilderMock.ctor).to.not.have.been.called;
        expect(setInputMapperMethod.stub).to.not.have.been.called;
        expect(setSchemaMethod.stub).to.not.have.been.called;
        expect(setOutputMapperMethod.stub).to.not.have.been.called;

        const ret = buildRoutes(definitions);

        expect(ret).to.equal(routerMock.instance);

        expect(routerCtor).to.have.been.calledOnce;
        expect(handlerBuilderMock.ctor).to.not.have.been.called;
        expect(setInputMapperMethod.stub).to.not.have.been.called;
        expect(setSchemaMethod.stub).to.not.have.been.called;
        expect(setOutputMapperMethod.stub).to.not.have.been.called;
    });

    it('should create a handler builder object for each route definition', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount).map(
            (definition) => {
                delete definition['name'];
                return definition;
            },
        );

        expect(handlerBuilderMock.ctor).to.not.have.been.called;

        buildRoutes(definitions);

        expect(handlerBuilderMock.ctor.callCount).to.equal(routeCount);

        definitions.forEach((definition, index) => {
            const { method, path, handler } = definition;
            const name = `${method} ${path}`;
            const call = handlerBuilderMock.ctor.getCall(index);
            expect(call).to.be.calledWithExactly(name, handler);
        });
    });

    it('should use the handler name if one is specified in the request definition', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount);

        expect(handlerBuilderMock.ctor).to.not.have.been.called;

        buildRoutes(definitions);

        expect(handlerBuilderMock.ctor.callCount).to.equal(routeCount);

        definitions.forEach((definition, index) => {
            const { name, handler } = definition;
            const call = handlerBuilderMock.ctor.getCall(index);
            expect(call).to.be.calledWithExactly(name, handler);
        });
    });

    it('should set the input mapper on the builder for each route definition', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount);
        const setInputMapperMethod = handlerBuilderMock.mocks.setInputMapper;

        expect(setInputMapperMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setInputMapperMethod.stub.callCount).to.equal(routeCount);

        definitions.forEach(({ inputMapper }, index) => {
            const call = setInputMapperMethod.stub.getCall(index);
            expect(call).to.be.calledWithExactly(inputMapper);
        });
    });

    it('should set the schema on the builder if the one was specified', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount);
        const setSchemaMethod = handlerBuilderMock.mocks.setSchema;

        expect(setSchemaMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setSchemaMethod.stub.callCount).to.equal(routeCount);

        definitions.forEach(({ schema }, index) => {
            const call = setSchemaMethod.stub.getCall(index);
            expect(call).to.be.calledWithExactly(schema);
        });
    });

    it('should not set the schema on the builder if the none was specified', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount, {
            schema: null,
        });
        const setSchemaMethod = handlerBuilderMock.mocks.setSchema;

        expect(setSchemaMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setSchemaMethod.stub).to.not.have.been.called;
    });

    it('should set the outputMapper on the builder if the one was specified', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount);
        const setOutputMapperMethod = handlerBuilderMock.mocks.setOutputMapper;

        expect(setOutputMapperMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setOutputMapperMethod.stub.callCount).to.equal(routeCount);

        definitions.forEach(({ outputMapper }, index) => {
            const call = setOutputMapperMethod.stub.getCall(index);
            expect(call).to.be.calledWithExactly(outputMapper);
        });
    });

    it('should not set the outputMapper on the builder if the none was specified', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount, {
            outputMapper: null,
        });
        const setOutputMapperMethod = handlerBuilderMock.mocks.setOutputMapper;

        expect(setOutputMapperMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setOutputMapperMethod.stub).to.not.have.been.called;
    });

    it('should build and mount a route for each route definition', async function () {
        const {
            testTarget: buildRoutes,
            routerMock,
            handlerBuilderMock,
        } = await _import();
        const routeCount = HTTP_METHODS.length;
        const definitions = _createRouteDefinitions(routeCount);

        const buildMethod = handlerBuilderMock.mocks.build;

        HTTP_METHODS.forEach((method) => {
            expect(routerMock.mocks[method].stub).to.not.have.been.called;
        });
        expect(buildMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        HTTP_METHODS.forEach((method) => {
            expect(routerMock.mocks[method].stub).to.have.been.calledOnce;
        });
        expect(buildMethod.stub.callCount).to.equal(routeCount);
    });
});
