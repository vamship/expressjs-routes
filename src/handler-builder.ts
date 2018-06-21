import {
    argValidator as _argValidator,
    schemaHelper as _schemaHelper
} from '@vamship/arg-utils';
import _configProvider from '@vamship/config';
import _loggerProvider from '@vamship/logger';
import { Promise } from 'bluebird';
import _dotProp from 'dot-prop';
import { Handler, NextFunction, Request, Response } from 'express';
import { InputMapper, OutputMapper, RequestHandler } from './handler-types';

const DEFAULT_INPUT_MAPPER = () => ({});
const DEFAULT_OUTPUT_MAPPER = (data: {}, res: Response) => res.json(data);

/**
 * Class that can be used to build HTTP request handlers for express js.
 * Breaks down requests into three distinct phases:
 * (1) Request mapping: Generate a JSON object from the incoming HTTP request
 * (2) Request processing: Process the JSON object and return a response
 * (3) Response mapping: Generate an HTTP response based on the JSON response
 * @module root
 */
export default class HandlerBuilder {
    private _inputMapper: InputMapper;
    private _handler: RequestHandler;
    private _outputMapper: OutputMapper;
    private _handlerName: string;
    private _schema?: {};

    /**
     * @param handler The request handler function
     * @param handlerName An identifying string for the handler
     */
    constructor(handlerName: string, handler: RequestHandler) {
        _argValidator.checkString(
            handlerName,
            1,
            'handlerName cannot be empty (arg #1)'
        );
        this._handler = handler;
        this._handlerName = handlerName;
        this._schema = undefined;
        this._inputMapper = DEFAULT_INPUT_MAPPER;
        this._outputMapper = DEFAULT_OUTPUT_MAPPER;
    }

    /**
     * Builds a request handler function that can be assigned to expressjs
     * routes.
     *
     * @return An expressjs request handler.
     */
    public build(): Handler {
        const logger = _loggerProvider.getLogger({
            request: this._handlerName
        });
        const config = _configProvider.getConfig();

        const schemaChecker = this._schema
            ? _schemaHelper.createSchemaChecker(this._schema)
            : () => {
                  logger.trace('No schema validations required');
                  return true;
              };

        return (req: Request, res: Response, next: NextFunction) => {
            Promise.try(() => {
                logger.trace('Mapping request to input object');
                const input = this._inputMapper(res);

                logger.trace('Performing schema validation', { input });
                schemaChecker(input, true);

                logger.trace('Invoking handler', { input });
                return this._handler(
                    input,
                    {},
                    {
                        logger,
                        config,
                        alias: process.env.NODE_ENV || 'default'
                    }
                );
            })
                .then((data) => {
                    logger.trace('Handler execution completed', { data });
                    return this._outputMapper(data, res, next);
                })
                .catch((ex) => {
                    next(ex);
                });
        };
    }

    /**
     * Sets the input mapping for the handler.
     *
     * @param mapping A mapping function that maps the HTTP request to an input
     *        object, or, a map that maps input properties to the corresponding
     *        values from the HTTP request. Supported mapping values include:
     *        1. params: Maps values from req.params to the input
     *        2. body: Maps values from req.body to the input
     *
     * @returns A reference to the handler builder, to be used for function
     *          chaining.
     */
    public setInputMapper(
        mapping: { [prop: string]: string } | InputMapper
    ): HandlerBuilder {
        if (typeof mapping === 'function') {
            this._inputMapper = mapping;
        } else {
            this._inputMapper = (req: Request) => {
                const input = {};
                return Object.keys(mapping).reduce((result, prop) => {
                    const path = mapping[prop];
                    const value = _dotProp.get(req, path);
                    _dotProp.set(result, prop, value);
                    return result;
                }, {});
            };
        }
        return this;
    }

    /**
     * Sets the schema to be used when validating mapped input objects.
     *
     * @param schema A JSON schema object that can be used to validate the
     *        mapped input.
     *
     * @returns A reference to the handler builder, to be used for function
     *          chaining.
     */
    public setSchema(schema: {}): HandlerBuilder {
        this._schema = schema;
        return this;
    }

    /**
     * Sets the output mapping for the handler.
     *
     * @param mapping A mapping function that maps the output of the handler
     *        function to an HTTP response object.
     *
     * @returns A reference to the handler builder, to be used for function
     *          chaining.
     */
    public setOutputMapper(mapping: OutputMapper): HandlerBuilder {
        this._outputMapper = mapping;
        return this;
    }
}
