import _loggerProvider from '@vamship/logger';
import { Router } from 'express';
import { HandlerBuilder } from './handler-builder.js';
import { IRouteDefinition } from './handler-types';

/**
 * Builds routes for a specific router based on delcarative route definitions.
 *
 * @param routes Route definitions for the routes that need to be mounted on the
 *        router.
 * @param router An optional expressjs router object on to which the routes will
 *        be mounted. If omitted, a new router will be created and used.
 *
 * @returns The configured router object, with the specified routes mounted on
 *          to it.
 */
export function buildRoutes(
    routes: IRouteDefinition[],
    router = Router(),
): Router {
    const logger = _loggerProvider.getLogger('buildRoutes');

    logger.trace('Adding routes to router');
    routes.forEach((definition) => {
        const {
            name,
            method,
            path,
            handler,
            inputMapper,
            schema,
            outputMapper,
        } = definition;

        const handlerName = name ? name : `${method} ${path}`;
        const builderLogger = logger.child({
            route: handlerName,
        });

        builderLogger.trace('Creating route builder');
        const builder = new HandlerBuilder(handlerName, handler).setInputMapper(
            inputMapper,
        );

        if (schema) {
            builderLogger.trace('Adding schema validation');
            builder.setSchema(schema);
        }

        if (outputMapper) {
            builderLogger.trace('Adding output mapper');
            builder.setOutputMapper(outputMapper);
        }

        builderLogger.trace('Mounting route to router');

        switch (method.toLowerCase()) {
            case 'all':
                router.all(path, builder.build());
                break;
            case 'get':
                router.get(path, builder.build());
                break;
            case 'post':
                router.post(path, builder.build());
                break;
            case 'put':
                router.put(path, builder.build());
                break;
            case 'delete':
                router.delete(path, builder.build());
                break;
            case 'patch':
                router.patch(path, builder.build());
                break;
            case 'options':
                router.options(path, builder.build());
                break;
            default:
                throw new Error(
                    `Unsupported HTTP method: ${method} for route ${handlerName}`,
                );
        }
    });

    return router;
}
