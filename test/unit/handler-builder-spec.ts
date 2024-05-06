import { expect, use as _useWithChai } from 'chai';
import _sinonChai from 'sinon-chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';

_useWithChai(_sinonChai);
_useWithChai(_chaiAsPromised);

import process from 'process';
import { Request, Response } from 'express';
import { mockReq, mockRes } from 'sinon-express-mock';
import { SinonSpy, stub, spy } from 'sinon';
import { JSONSchemaType } from 'ajv';
import _esmock from 'esmock';

import {
    ObjectMock,
    MockImportHelper,
    testValues as _testValues,
    asyncHelper as _asyncHelper,
} from '@vamship/test-utils';
import { schemaHelper } from '@vamship/arg-utils';
import logManager, { ILogger, LogManager } from '@vamship/logger';
import { ArgError } from '@vamship/error-types';
import { HandlerBuilder } from '../../src/handler-builder.js';
import {
    IInput,
    InputMapper,
    OutputMapper,
    RequestHandler,
} from '../../src/handler-types.js';

describe('HandlerBuilder', function () {
    type HandlerBuilderPrivate = {
        _inputMapper: InputMapper;
        _outputMapper: OutputMapper;
        _schema?: JSONSchemaType<unknown>;
    };

    type SchemaHelperType = typeof schemaHelper;

    type SchemaHelperState = {
        checkSchema: SinonSpy;
        validationError?: Error;
    };

    type ImportResult = {
        testTarget: typeof HandlerBuilder;
        schemaHelperMock: ObjectMock<SchemaHelperType>;
        schemaHelperState: SchemaHelperState;
        logManagerMock: ObjectMock<LogManager>;
        loggerMock: ObjectMock<ILogger>;
    };

    async function _import(): Promise<ImportResult> {
        type HandlerBuilderModule = {
            HandlerBuilder: HandlerBuilder;
        };
        const importHelper = new MockImportHelper<HandlerBuilderModule>(
            'project://src/handler-builder.js',
            {
                'arg-utils': '@vamship/arg-utils',
                logger: '@vamship/logger',
            },
            import.meta.resolve('../../../working'),
        );

        const schemaHelperState: SchemaHelperState = {
            checkSchema: stub().callsFake(() => {
                if (schemaHelperState.validationError instanceof Error) {
                    throw schemaHelperState.validationError;
                }
                return true;
            }),
            validationError: undefined,
        };

        const schemaHelperMock = new ObjectMock<typeof schemaHelper>().addMock(
            'createSchemaChecker',
            () => schemaHelperState.checkSchema,
        );

        const loggerMock: ObjectMock<ILogger> = [
            'silent',
            'trace',
            'debug',
            'info',
            'warn',
            'error',
            'fatal',
            'child',
        ].reduce(
            (result, item) => result.addMock(item, spy()),
            new ObjectMock<ILogger>(),
        );
        const logManagerMock = new ObjectMock<typeof logManager>().addMock(
            'getLogger',
            loggerMock.instance,
        );

        importHelper.setMock('arg-utils', {
            schemaHelper: schemaHelperMock.instance,
        });

        importHelper.setMock('logger', {
            default: logManagerMock.instance,
        });

        const targetModule = await _esmock(
            importHelper.importPath,
            importHelper.getLibs(),
            importHelper.getGlobals(),
        );

        return {
            testTarget: targetModule.HandlerBuilder,
            schemaHelperState,
            schemaHelperMock,
            logManagerMock,
            loggerMock,
        };
    }

    async function _createInstance(
        handlerName = _testValues.getString('handlerName'),
        handler: RequestHandler = spy(),
    ): Promise<{
        builder: HandlerBuilder;
        builderPrivate: HandlerBuilderPrivate;
        schemaHelperState: SchemaHelperState;
        loggerMock: ObjectMock<ILogger>;
    }> {
        const {
            testTarget: HandlerBuilder,
            schemaHelperState,
            loggerMock,
        } = await _import();
        const builder = new HandlerBuilder(handlerName, handler);

        return {
            builder,
            builderPrivate: builder as unknown as HandlerBuilderPrivate,
            schemaHelperState,
            loggerMock,
        };
    }

    function _getExpressObjects(data: Record<string, unknown> = {}): {
        req: Request;
        res: Response;
        next: () => void;
    } {
        return {
            req: mockReq(data),
            res: mockRes(),
            next: stub(),
        };
    }

    describe('ctor()', function () {
        _testValues.allButString('').forEach((handlerName) => {
            it(`should throw an error if invoked without a valid handler name (value=${handlerName})`, async function () {
                const { testTarget: HandlerBuilder } = await _import();
                const message = 'handlerName cannot be empty (arg #1)';
                const wrapper = (): HandlerBuilder => {
                    const handler: RequestHandler = spy();
                    return new HandlerBuilder(handlerName as string, handler);
                };
                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should expose the expected properties and methods', async function () {
            const handlerName = _testValues.getString('handlerName');
            const handler: RequestHandler = spy();
            const builder = new HandlerBuilder(handlerName, handler);

            expect(builder.setInputMapper).to.be.a('function');
            expect(builder.setSchema).to.be.a('function');
            expect(builder.setOutputMapper).to.be.a('function');
            expect(builder.build).to.be.a('function');
        });
    });

    describe('setInputMapper()', function () {
        it('should return a reference to the builder object', async function () {
            const { builder, builderPrivate } = await _createInstance();
            const inputMapper: InputMapper = spy();

            const ret = builder.setInputMapper(inputMapper);

            expect(ret).to.equal(builder);
        });

        it('should use the arg as the input mapper if a function is provided', async function () {
            const { builder, builderPrivate } = await _createInstance();
            const inputMapper: InputMapper = spy();

            expect(builderPrivate._inputMapper).to.not.equal(inputMapper);

            builder.setInputMapper(inputMapper);

            expect(builderPrivate._inputMapper).to.equal(inputMapper);
        });

        it('should generate a function that maps properties from the request if a map is provided', async function () {
            const { builder, builderPrivate } = await _createInstance();
            builder.setInputMapper({
                'data.name': 'params.name',
                'data.language': 'body.lang',
            });

            expect(builderPrivate._inputMapper).to.be.a('function');
        });

        describe('[generated mapper behavior]', function () {
            it('should map properties from the request params', async function () {
                const { builder, builderPrivate } = await _createInstance();

                builder.setInputMapper({
                    'data.name': 'params.name',
                    'data.language': 'params.language',
                });

                const params = {
                    name: _testValues.getString('name'),
                    language: _testValues.getString('language'),
                };
                const { req } = _getExpressObjects({
                    params,
                });

                const input = builderPrivate._inputMapper(req);
                expect(input).to.deep.equal({
                    data: {
                        name: params.name,
                        language: params.language,
                    },
                });
            });

            it('should map properties from the request body', async function () {
                const { builder, builderPrivate } = await _createInstance();

                builder.setInputMapper({
                    'data.name': 'body.name',
                    'data.language': 'body.language',
                });

                const body = {
                    name: _testValues.getString('name'),
                    language: _testValues.getString('language'),
                };
                const { req } = _getExpressObjects({
                    body,
                });

                const input = builderPrivate._inputMapper(req);
                expect(input).to.deep.equal({
                    data: {
                        name: body.name,
                        language: body.language,
                    },
                });
            });
        });
    });

    describe('setSchema()', function () {
        it('should return a reference to the builder object', async function () {
            const { builder, builderPrivate } = await _createInstance();
            const schemaMock = {} as JSONSchemaType<unknown>;

            const ret = builder.setSchema(schemaMock);

            expect(ret).to.equal(builder);
        });

        it('should use the specified schema object as the schema for the builder', async function () {
            const { builder, builderPrivate } = await _createInstance();
            const schemaMock = {} as JSONSchemaType<unknown>;

            expect(builderPrivate._schema).to.not.equal(schemaMock);

            builder.setSchema(schemaMock);

            expect(builderPrivate._schema).to.equal(schemaMock);
        });
    });

    describe('setOutputMapper()', function () {
        it('should return a reference to the builder object', async function () {
            const { builder, builderPrivate } = await _createInstance();
            const outputMapperMock = spy();
            const ret = builder.setOutputMapper(outputMapperMock);

            expect(ret).to.equal(builder);
        });

        it('should use the specified output mapper as the output mapper for the builder', async function () {
            const { builder, builderPrivate } = await _createInstance();
            const outputMapperMock = spy();

            expect(builderPrivate._outputMapper).to.not.equal(outputMapperMock);

            builder.setOutputMapper(outputMapperMock);

            expect(builderPrivate._outputMapper).to.equal(outputMapperMock);
        });
    });

    describe('build()', function () {
        it('should return a function when invoked', async function () {
            const { builder } = await _createInstance();
            const ret = builder.build();

            expect(ret).to.be.a('function');
        });

        describe('[handler behavior]', function () {
            it('should use the input mapper to map the http request', async function () {
                const { builder } = await _createInstance();
                const inputMapperMock = stub().returns({});

                builder.setInputMapper(inputMapperMock);

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                await handler(req, res, next);

                expect(inputMapperMock).to.have.been.calledOnce;
                expect(inputMapperMock).to.have.been.calledWithExactly(req);
            });

            it('should invoke next() if the input mapper throws an error', async function () {
                const { builder } = await _createInstance();

                const error = new Error('something went wrong!');
                const inputMapperMock = stub().throws(error);

                builder.setInputMapper(inputMapperMock);
                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                await handler(req, res, next);

                expect(next).to.have.been.calledOnce;
                expect(next).to.have.been.calledWithExactly(error);
            });

            it('should skip schema validation if a no schema is set', async function () {
                const { builder, schemaHelperState } = await _createInstance();

                const checkSchema = schemaHelperState.checkSchema;
                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                expect(checkSchema).to.not.have.been.called;

                await handler(req, res, next);

                expect(checkSchema).to.not.have.been.called;
            });

            it('should perform schema validation if a valid schema is set', async function () {
                const { builder, schemaHelperState } = await _createInstance();

                const expectedInput = {
                    foo: _testValues.getString('foo'),
                    bar: _testValues.getString('bar'),
                };
                const inputMapperMock = stub().returns(expectedInput);
                const schema = {} as JSONSchemaType<unknown>;

                builder.setInputMapper(inputMapperMock);
                builder.setSchema(schema);

                const checkSchema = schemaHelperState.checkSchema;
                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                expect(checkSchema).to.not.have.been.called;

                await handler(req, res, next);

                expect(checkSchema).to.have.been.calledOnce;
                expect(checkSchema).to.have.been.calledWithExactly(
                    expectedInput,
                    true,
                );
            });

            it('should invoke next() if the schema validator throws an error', async function () {
                const { builder, schemaHelperState } = await _createInstance();
                const error = new Error('something went wrong!');

                schemaHelperState.validationError = error;
                builder.setSchema({} as JSONSchemaType<unknown>);

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                await handler(req, res, next);

                expect(next).to.have.been.calledOnce;
                expect(next).to.have.been.calledWithExactly(error);
            });

            it('should invoke the request processor with the result of the input mapper', async function () {
                const reqHandler = stub().returns({});
                const { builder, loggerMock } = await _createInstance(
                    undefined,
                    reqHandler,
                );
                const expectedInput = {
                    foo: _testValues.getString('foo'),
                    bar: _testValues.getString('bar'),
                };
                const inputMapperMock = stub().returns(expectedInput);

                builder.setInputMapper(inputMapperMock);

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                await handler(req, res, next);

                expect(reqHandler).to.have.been.calledOnce;
                expect(reqHandler.args[0].length).to.equal(3);

                const input = reqHandler.args[0][0];
                const context = reqHandler.args[0][1];
                const ext = reqHandler.args[0][2];

                expect(input).to.deep.equal(expectedInput);
                expect(context).to.be.an('object');
                expect(context.requestId).to.be.a('string').and.to.not.be.empty;
                expect(ext).to.be.an('object');
                expect(ext.logger).to.equal(loggerMock.instance);
                expect(ext.alias).to.be.a('string').and.to.not.be.empty;
            });

            it('should invoke next() if the request processor throws an error', async function () {
                const error = new Error('something went wrong!');
                const reqHandler = stub().throws(error);
                const { builder } = await _createInstance(
                    undefined,
                    reqHandler,
                );

                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                await handler(req, res, next);

                expect(next).to.have.been.calledOnce;
                expect(next).to.have.been.calledWithExactly(error);
            });

            it('should invoke the output mapper with the result of the request processor', async function () {
                const processingResult = {
                    foo: _testValues.getString('foo'),
                    bar: _testValues.getString('bar'),
                };
                const reqHandler = stub().returns(processingResult);
                const { builder } = await _createInstance(undefined, reqHandler);
                const outputMapperMock = spy();

                builder.setOutputMapper(outputMapperMock);
                const handler = builder.build();
                const { req, res, next } = _getExpressObjects();

                await handler(req, res, next);
                expect(outputMapperMock).to.have.been.calledOnce;
                expect(outputMapperMock).to.have.been.calledWithExactly(
                    processingResult,
                    res,
                    next,
                );
            });
        });
    });
});
