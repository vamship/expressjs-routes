import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import _rewire from 'rewire';
import _sinon from 'sinon';
import _sinonChai from 'sinon-chai';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
const expect = _chai.expect;

import { ObjectMock, testValues as _testValues } from '@vamship/test-utils';

import { IRouteDefinition } from '../../src/handler-types';
const _buildRoutesModule = _rewire('../../src/build-routes');
const buildRoutes = _buildRoutesModule.default;

const HTTP_METHODS = ['get', 'put', 'post', 'delete'];

describe('buildRoutes()', () => {
    function _createRouteDefinitions(
        count = 1,
        options?: Record<string, unknown>
    ): IRouteDefinition[] {
        const routes: IRouteDefinition[] = [];

        for (let index = 0; index < count; index++) {
            routes.push(
                Object.assign(
                    {
                        name: _testValues.getString('handlerName'),
                        method: HTTP_METHODS[index % HTTP_METHODS.length],
                        path: `/${_testValues.getString(
                            'foo'
                        )}/:${_testValues.getString('bar')}`,
                        inputMapper: _sinon.stub().returns({}),
                        schema: {},
                        outputMapper: _sinon.spy(),
                        handler: _sinon.stub().returns({}),
                    },
                    options
                )
            );
        }
        return routes;
    }

    let _RouterMock;
    let _HandlerBuilderMock;

    beforeEach(() => {
        _RouterMock = new ObjectMock();
        HTTP_METHODS.forEach((method) => _RouterMock.addMock(method));

        _HandlerBuilderMock = new ObjectMock()
            .addMock('setInputMapper', () => _HandlerBuilderMock.instance)
            .addMock('setSchema', () => _HandlerBuilderMock.instance)
            .addMock('setOutputMapper', () => _HandlerBuilderMock.instance)
            .addMock('build', () => _HandlerBuilderMock.__route);
        _HandlerBuilderMock.__route = _sinon.stub();

        _buildRoutesModule.__set__('express_1', {
            Router: _RouterMock.ctor,
        });
        _buildRoutesModule.__set__('handler_builder_1', {
            default: _HandlerBuilderMock.ctor,
        });
    });

    it('should return an express js router when invoked', () => {
        const definitions = _createRouteDefinitions(10);
        const ret = buildRoutes(definitions);

        expect(ret).to.equal(_RouterMock.instance);
    });

    it('should create an expressjs router object if no router was specified', () => {
        const definitions = _createRouteDefinitions(10);
        const routerCtor = _RouterMock.ctor;

        expect(routerCtor).to.not.have.been.called;

        buildRoutes(definitions);

        expect(routerCtor).to.have.been.calledOnce;
    });

    it('should not create an expressjs router object if a router was specified', () => {
        const definitions = _createRouteDefinitions(10);
        const routerCtor = _RouterMock.ctor;

        expect(routerCtor).to.not.have.been.called;

        buildRoutes(definitions, _RouterMock.instance);

        expect(routerCtor).to.not.have.been.called;
    });

    it('should not mount any routes on to the router if the route definition list is empty', () => {
        const definitions = [];

        const routerCtor = _RouterMock.ctor;
        const setInputMapperMethod = _HandlerBuilderMock.mocks.setInputMapper;
        const setSchemaMethod = _HandlerBuilderMock.mocks.setSchema;
        const setOutputMapperMethod = _HandlerBuilderMock.mocks.setOutputMapper;

        expect(routerCtor).to.not.have.been.called;
        expect(_HandlerBuilderMock.ctor).to.not.have.been.called;
        expect(setInputMapperMethod.stub).to.not.have.been.called;
        expect(setSchemaMethod.stub).to.not.have.been.called;
        expect(setOutputMapperMethod.stub).to.not.have.been.called;

        const ret = buildRoutes(definitions);

        expect(ret).to.equal(_RouterMock.instance);

        expect(routerCtor).to.have.been.calledOnce;
        expect(_HandlerBuilderMock.ctor).to.not.have.been.called;
        expect(setInputMapperMethod.stub).to.not.have.been.called;
        expect(setSchemaMethod.stub).to.not.have.been.called;
        expect(setOutputMapperMethod.stub).to.not.have.been.called;
    });

    it('should create a handler builder object for each route definition', () => {
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount).map(
            (definition) => {
                delete definition['name'];
                return definition;
            }
        );

        expect(_HandlerBuilderMock.ctor).to.not.have.been.called;

        buildRoutes(definitions);

        expect(_HandlerBuilderMock.ctor.callCount).to.equal(routeCount);

        definitions.forEach((definition, index) => {
            const { method, path, handler } = definition;
            const name = `${method} ${path}`;
            const call = _HandlerBuilderMock.ctor.getCall(index);
            expect(call).to.be.calledWithExactly(name, handler);
        });
    });

    it('should use the handler name if one is specified in the request definition', () => {
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount);

        expect(_HandlerBuilderMock.ctor).to.not.have.been.called;

        buildRoutes(definitions);

        expect(_HandlerBuilderMock.ctor.callCount).to.equal(routeCount);

        definitions.forEach((definition, index) => {
            const { name, handler } = definition;
            const call = _HandlerBuilderMock.ctor.getCall(index);
            expect(call).to.be.calledWithExactly(name, handler);
        });
    });

    it('should set the input mapper on the builder for each route definition', () => {
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount);
        const setInputMapperMethod = _HandlerBuilderMock.mocks.setInputMapper;

        expect(setInputMapperMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setInputMapperMethod.stub.callCount).to.equal(routeCount);

        definitions.forEach(({ inputMapper }, index) => {
            const call = setInputMapperMethod.stub.getCall(index);
            expect(call).to.be.calledWithExactly(inputMapper);
        });
    });

    it('should set the schema on the builder if the one was specified', () => {
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount);
        const setSchemaMethod = _HandlerBuilderMock.mocks.setSchema;

        expect(setSchemaMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setSchemaMethod.stub.callCount).to.equal(routeCount);

        definitions.forEach(({ schema }, index) => {
            const call = setSchemaMethod.stub.getCall(index);
            expect(call).to.be.calledWithExactly(schema);
        });
    });

    it('should not set the schema on the builder if the none was specified', () => {
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount, {
            schema: null,
        });
        const setSchemaMethod = _HandlerBuilderMock.mocks.setSchema;

        expect(setSchemaMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setSchemaMethod.stub).to.not.have.been.called;
    });

    it('should set the outputMapper on the builder if the one was specified', () => {
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount);
        const setOutputMapperMethod = _HandlerBuilderMock.mocks.setOutputMapper;

        expect(setOutputMapperMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setOutputMapperMethod.stub.callCount).to.equal(routeCount);

        definitions.forEach(({ outputMapper }, index) => {
            const call = setOutputMapperMethod.stub.getCall(index);
            expect(call).to.be.calledWithExactly(outputMapper);
        });
    });

    it('should not set the outputMapper on the builder if the none was specified', () => {
        const routeCount = 10;
        const definitions = _createRouteDefinitions(routeCount, {
            outputMapper: null,
        });
        const setOutputMapperMethod = _HandlerBuilderMock.mocks.setOutputMapper;

        expect(setOutputMapperMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        expect(setOutputMapperMethod.stub).to.not.have.been.called;
    });

    it('should build and mount a route for each route definition', () => {
        const routeCount = HTTP_METHODS.length;
        const definitions = _createRouteDefinitions(routeCount);

        const buildMethod = _HandlerBuilderMock.mocks.build;

        HTTP_METHODS.forEach((method) => {
            expect(_RouterMock.mocks[method].stub).to.not.have.been.called;
        });
        expect(buildMethod.stub).to.not.have.been.called;

        buildRoutes(definitions);

        HTTP_METHODS.forEach((method) => {
            expect(_RouterMock.mocks[method].stub).to.have.been.calledOnce;
        });
        expect(buildMethod.stub.callCount).to.equal(routeCount);
    });
});
