/**
 * @module root
 */
import {
    argValidator as _argValidator,
    schemaHelper as _schemaHelper,
} from '@vamship/arg-utils';
import { JSONSchemaType } from 'ajv';
import _logManager from '@vamship/logger';
import { getProperty, setProperty } from 'dot-prop';
import { Handler, NextFunction, Request, Response } from 'express';
import {
    IInput,
    InputMapper,
    OutputMapper,
    RequestHandler,
} from './handler-types.js';
import process from 'process';

/**
 * Class that can be used to build HTTP request handlers for express js.
 * Breaks down requests into three distinct phases:
 *
 * (1) Request mapping: Generate a JSON object from the incoming HTTP request
 *
 * (2) Request processing: Process the JSON object and return a response
 *
 * (3) Response mapping: Generate an HTTP response based on the JSON response
 */
export class HandlerBuilder {
    private static DEFAULT_INPUT_MAPPER(): IInput {
        return {};
    }
    private static async DEFAULT_OUTPUT_MAPPER(
        data: unknown,
        res: Response,
    ): Promise<void> {
        res.json(data);
    }

    private _inputMapper: InputMapper;
    private _handler: RequestHandler;
    private _outputMapper: OutputMapper;
    private _handlerName: string;
    private _schema?: JSONSchemaType<unknown>;

    /**
     * @param handler The request handler function
     * @param handlerName An identifying string for the handler
     */
    constructor(handlerName: string, handler: RequestHandler) {
        _argValidator.checkString(
            handlerName,
            1,
            'handlerName cannot be empty (arg #1)',
        );
        this._handler = handler;
        this._handlerName = handlerName;
        this._schema = undefined;
        this._inputMapper = HandlerBuilder.DEFAULT_INPUT_MAPPER;
        this._outputMapper = HandlerBuilder.DEFAULT_OUTPUT_MAPPER;
    }

    /**
     * Builds a request handler function that can be assigned to expressjs
     * routes.
     *
     * @return An expressjs request handler.
     */
    public build(): Handler {
        const schemaChecker = this._schema
            ? _schemaHelper.createSchemaChecker(this._schema)
            : undefined;

        return async (
            req: Request,
            res: Response,
            next: NextFunction,
        ): Promise<void> => {
            const requestId = Math.random().toString(36).substring(2, 15);

            const logger = _logManager.getLogger(
                `handler:${this._handlerName}`,
                {
                    requestId,
                },
            );

            try {
                logger.trace('HANDLER START');
                logger.trace('Mapping request to input');
                const input = this._inputMapper(req);

                logger.trace({ input }, 'Handler input');

                if (this._schema) {
                    logger.trace('Validating input schema');
                    schemaChecker!(input, true);
                } else {
                    logger.trace(
                        'No schema specified. Skipping schema validation',
                    );
                }

                logger.trace('Executing handler');
                const output = await this._handler(
                    input,
                    {
                        requestId,
                    },
                    {
                        logger,
                        alias: process.env.NODE_ENV || 'default',
                    },
                );
                logger.trace({ output }, 'Handler output');
                logger.trace('HANDLER END');

                await this._outputMapper(output, res, next);
            } catch (ex) {
                logger.error(ex, 'Error executing handler');
                logger.trace('HANDLER END');
                next(ex);
            }
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
        mapping: { [prop: string]: string } | InputMapper,
    ): HandlerBuilder {
        if (typeof mapping === 'function') {
            this._inputMapper = mapping;
        } else {
            this._inputMapper = (req: Request): Record<string, unknown> => {
                return Object.keys(mapping).reduce((result, prop) => {
                    const path = mapping[prop];
                    const value = getProperty(req, path);
                    setProperty(result, prop, value);
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
    public setSchema(schema: JSONSchemaType<unknown>): HandlerBuilder {
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
