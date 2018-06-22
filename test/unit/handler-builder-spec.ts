import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import _rewire from 'rewire';
import _sinon from 'sinon';
import _sinonChai from 'sinon-chai';
import { mockReq, mockRes } from 'sinon-express-mock';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
const expect = _chai.expect;

import _argUtils from '@vamship/arg-utils';
import { ArgError } from '@vamship/error-types';
import {
    asyncHelper as _asyncHelper,
    ObjectMock,
    testValues as _testValues
} from '@vamship/test-utils';

const _handlerBuilderModule = _rewire('../../src/handler-builder');
const HandlerBuilder = _handlerBuilderModule.default;

describe('HandlerBuilder', () => {
    function _createInstance(handlerName?: string, handler?: () => {}) {
        const hName: string =
            handlerName || _testValues.getString('handlerName');
        const handlerRef: () => {} = handler || _sinon.spy();
        return new HandlerBuilder(hName, handlerRef);
    }

    function _getExpressObjects(data?: object) {
        const reqData: object = data || {};
        return {
            req: mockReq(reqData),
            res: mockRes(),
            next: _sinon.stub()
        };
    }

    let _schemaHelperMock;
    let _loggerProviderMock;
    let _configProviderMock;

    beforeEach(() => {
        _schemaHelperMock = new ObjectMock().addMock(
            'createSchemaChecker',
            () => {
                return _schemaHelperMock.__checkSchema;
            }
        );
        _schemaHelperMock.__schemaValidationResult = true;
        _schemaHelperMock.__checkSchema = _sinon.stub().callsFake(() => {
            const result = _schemaHelperMock.__schemaValidationResult;
            if (result instanceof Error) {
                throw result;
            }
            return true;
        });

        const config = {
            get: _sinon.stub()
        };
        _configProviderMock = new ObjectMock().addMock('getConfig', config);
        _configProviderMock.__config = config;

        const logger = {};
        ['trace', 'debug', 'info', 'warn', 'fatal', 'child'].forEach(
            (method) => {
                logger[method] = _sinon.spy();
            }
        );
        _loggerProviderMock = new ObjectMock().addMock('getLogger', logger);
        _loggerProviderMock.__logger = logger;

        _argUtils.schemaHelper = _schemaHelperMock.instance;
        _handlerBuilderModule.__set__('config_1', {
            default: _configProviderMock.instance
        });
        _handlerBuilderModule.__set__('logger_1', {
            default: _loggerProviderMock.instance
        });
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid handler name', () => {
            const message = 'handlerName cannot be empty (arg #1)';
            const wrapper = () => {
                const handler = () => ({});
                return new HandlerBuilder('', handler);
            };

            expect(wrapper).to.throw(ArgError, message);
        });

        it('should expose the expected properties and methods', () => {
            const handlerName = _testValues.getString('handlerName');
            const handler = () => ({});

            const builder = new HandlerBuilder(handlerName, handler);
            expect(builder.setInputMapper).to.be.a('function');
            expect(builder.setSchema).to.be.a('function');
            expect(builder.setOutputMapper).to.be.a('function');
            expect(builder.build).to.be.a('function');
        });
    });

    describe('setInputMapper()', () => {
        it('should return a reference to the builder object', () => {
            const builder = _createInstance() as any;
            const inputMapper = () => _sinon.spy();

            const ret = builder.setInputMapper(inputMapper);
            expect(ret).to.equal(builder);
        });

        it('should use the arg as the input mapper if a function is provided', () => {
            const builder = _createInstance() as any;
            const inputMapper = () => _sinon.spy();

            expect(builder._inputMapper).to.not.equal(inputMapper);
            builder.setInputMapper(inputMapper);
            expect(builder._inputMapper).to.equal(inputMapper);
        });

        it('should generate a function that maps properties from the request if a map is provided', () => {
            const builder = _createInstance();
            builder.setInputMapper({
                'data.name': 'params.name',
                'data.language': 'body.lang'
            });
            expect(builder._inputMapper).to.be.a('function');
        });

        describe('[generated mapper behavior]', () => {
            it('should map properties from the request params', () => {
                const builder = _createInstance() as any;
                builder.setInputMapper({
                    'data.name': 'params.name',
                    'data.language': 'params.language'
                });

                const params = {
                    name: _testValues.getString('name'),
                    language: _testValues.getString('language')
                };
                const { req } = _getExpressObjects({
                    params
                });
                const input = builder._inputMapper(req);

                expect(input).to.deep.equal({
                    data: {
                        name: params.name,
                        language: params.language
                    }
                });
            });

            it('should map properties from the request body', () => {
                const builder = _createInstance() as any;
                builder.setInputMapper({
                    'data.name': 'body.name',
                    'data.language': 'body.language'
                });

                const body = {
                    name: _testValues.getString('name'),
                    language: _testValues.getString('language')
                };
                const { req } = _getExpressObjects({
                    body
                });
                const input = builder._inputMapper(req);

                expect(input).to.deep.equal({
                    data: {
                        name: body.name,
                        language: body.language
                    }
                });
            });
        });
    });

    describe('setSchema()', () => {
        it('should return a reference to the builder object', () => {
            const builder = _createInstance();
            const schemaMock = {};

            const ret = builder.setSchema(schemaMock);
            expect(ret).to.equal(builder);
        });

        it('should use the specified schema object as the schema for the builder', () => {
            const builder = _createInstance() as any;
            const schemaMock = {};

            expect(builder._schema).to.not.equal(schemaMock);
            builder.setSchema(schemaMock);
            expect(builder._schema).to.equal(schemaMock);
        });
    });

    describe('setOutputMapper()', () => {
        it('should return a reference to the builder object', () => {
            const builder = _createInstance();
            const outputMapperMock = _sinon.spy();

            const ret = builder.setOutputMapper(outputMapperMock);
            expect(ret).to.equal(builder);
        });

        it('should use the specified output mapper as the output mapper for the builder', () => {
            const builder = _createInstance() as any;
            const outputMapperMock = _sinon.spy();

            expect(builder._outputMapper).to.not.equal(outputMapperMock);
            builder.setOutputMapper(outputMapperMock);
            expect(builder._outputMapper).to.equal(outputMapperMock);
        });
    });

    describe('build()', () => {
        it('should return a function when invoked', () => {
            const builder = _createInstance();

            const ret = builder.build();
            expect(ret).to.be.a('function');
        });

        describe('[handler behavior]', () => {
            it('should use the input mapper to map the http request', (done) => {
                const builder = _createInstance();
                const inputMapperMock = _sinon.stub().returns({});
                builder.setInputMapper(inputMapperMock);

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();
                handler(req, res, next);

                _asyncHelper
                    .wait(10)()
                    .then(() => {
                        expect(inputMapperMock).to.have.been.calledOnce;
                        expect(inputMapperMock).to.have.been.calledWithExactly(
                            req
                        );
                    })
                    .then(done, done);
            });

            it('should invoke next() if the input mapper throws an error', (done) => {
                const builder = _createInstance();
                const error = new Error('something went wrong!');
                const inputMapperMock = _sinon.stub().throws(error);
                builder.setInputMapper(inputMapperMock);

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();
                handler(req, res, next);

                _asyncHelper
                    .wait(10)()
                    .then(() => {
                        expect(next).to.have.been.calledOnce;
                        expect(next).to.have.been.calledWithExactly(error);
                    })
                    .then(done, done);
            });

            it('should skip schema validation if a no schema is set', (done) => {
                const builder = _createInstance();
                const checkSchema = _schemaHelperMock.__checkSchema;

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                expect(checkSchema).to.not.have.been.called;

                handler(req, res, next);

                _asyncHelper
                    .wait(10)()
                    .then(() => {
                        expect(checkSchema).to.not.have.been.called;
                    })
                    .then(done, done);
            });

            it('should perform schema validation if a valid schema is set', (done) => {
                const builder = _createInstance();
                const expectedInput = {
                    foo: _testValues.getString('foo'),
                    bar: _testValues.getString('bar')
                };
                const inputMapperMock = _sinon.stub().returns(expectedInput);
                const schema = {};

                builder.setInputMapper(inputMapperMock);
                builder.setSchema(schema);

                const checkSchema = _schemaHelperMock.__checkSchema;

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                expect(checkSchema).to.not.have.been.called;

                handler(req, res, next);

                _asyncHelper
                    .wait(10)()
                    .then(() => {
                        expect(checkSchema).to.have.been.calledOnce;
                        expect(checkSchema).to.have.been.calledWithExactly(
                            expectedInput,
                            true
                        );
                    })
                    .then(done, done);
            });

            it('should invoke next() if the schema validator throws an error', (done) => {
                const builder = _createInstance();
                const error = new Error('something went wrong!');
                _schemaHelperMock.__schemaValidationResult = error;
                builder.setSchema({});

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();
                handler(req, res, next);

                _asyncHelper
                    .wait(10)()
                    .then(() => {
                        expect(next).to.have.been.calledOnce;
                        expect(next).to.have.been.calledWithExactly(error);
                    })
                    .then(done, done);
            });

            it('should invoke the request processor with the result of the input mapper', (done) => {
                const reqHandler = _sinon.stub().returns({});
                const builder = _createInstance(undefined, reqHandler);

                const expectedInput = {
                    foo: _testValues.getString('foo'),
                    bar: _testValues.getString('bar')
                };
                const inputMapperMock = _sinon.stub().returns(expectedInput);
                builder.setInputMapper(inputMapperMock);

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();
                handler(req, res, next);

                _asyncHelper
                    .wait(10)()
                    .then(() => {
                        expect(reqHandler).to.have.been.calledOnce;
                        expect(reqHandler.args[0].length).to.equal(3);

                        const input = reqHandler.args[0][0];
                        const context = reqHandler.args[0][1];
                        const ext = reqHandler.args[0][2];

                        expect(input).to.deep.equal(expectedInput);
                        expect(context).to.deep.equal({});
                        expect(ext).to.be.an('object');
                        expect(ext.logger).to.equal(
                            _loggerProviderMock.__logger
                        );
                        expect(ext.config).to.equal(
                            _configProviderMock.__config
                        );
                        expect(ext.alias).to.be.a('string').and.to.not.be.empty;
                    })
                    .then(done, done);
            });

            it('should invoke next() if the request processor throws an error', (done) => {
                const error = new Error('something went wrong!');
                const reqHandler = _sinon.stub().throws(error);
                const builder = _createInstance(undefined, reqHandler);
                builder.setSchema({});

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();
                handler(req, res, next);

                _asyncHelper
                    .wait(10)()
                    .then(() => {
                        expect(next).to.have.been.calledOnce;
                        expect(next).to.have.been.calledWithExactly(error);
                    })
                    .then(done, done);
            });

            it('should invoke the output mapper with the result of the request processor', (done) => {
                const processingResult = {
                    foo: _testValues.getString('foo'),
                    bar: _testValues.getString('bar')
                };
                const reqHandler = _sinon.stub().returns(processingResult);
                const builder = _createInstance(undefined, reqHandler);

                const outputMapperMock = _sinon.spy();
                builder.setOutputMapper(outputMapperMock);

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();
                handler(req, res, next);

                _asyncHelper
                    .wait(10)()
                    .then(() => {
                        expect(outputMapperMock).to.have.been.calledOnce;
                        expect(outputMapperMock).to.have.been.calledWithExactly(
                            processingResult,
                            res,
                            next
                        );
                    })
                    .then(done, done);
            });
        });
    });
});
