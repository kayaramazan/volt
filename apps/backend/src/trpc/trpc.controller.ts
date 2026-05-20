import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';

import { TrpcRouter } from './trpc.router';
import { createTrpcContext } from './context';

@Controller('trpc')
export class TrpcController {
  constructor(private readonly router: TrpcRouter) {}

  /**
   * tRPC uses its own URL routing under the prefix. We delegate the entire
   * request to its express handler.
   */
  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    const handler = trpcExpress.createExpressMiddleware({
      router: this.router.build(),
      createContext: ({ req, res }) => createTrpcContext(req, res),
    });
    // Strip the /api/trpc prefix from req.url so tRPC sees clean paths
    req.url = req.url.replace(/^\/api\/trpc/, '') || '/';
    return handler(req, res, () => {
      /* next not needed — tRPC ends the response */
    });
  }
}
