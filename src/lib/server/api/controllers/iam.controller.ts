import { setCookie } from 'hono/cookie';
import { inject, injectable } from 'tsyringe';
import { zValidator } from '@hono/zod-validator';
import { IamService } from '../services/iam.service';
import { limiter } from '../middlewares/rate-limiter.middlware';
import { requireAuth } from '../middlewares/auth.middleware';
import { Controler } from '../common/types/controller';
import { registerEmailDto } from '$lib/server/api/dtos/register-email.dto';
import { signInEmailDto } from '$lib/server/api/dtos/signin-email.dto';
import { updateEmailDto } from '$lib/server/api/dtos/update-email.dto';
import { verifyEmailDto } from '$lib/server/api/dtos/verify-email.dto';
import { LuciaService } from '../services/lucia.service';

@injectable()
export class IamController extends Controler {
	constructor(
		@inject(IamService) private iamService: IamService,
		@inject(LuciaService) private luciaService: LuciaService,
	) {
		super();
	}

	routes() {
		return this.controller
			.get('/user', async (c) => {
				const user = c.var.user;
				return c.json({ user: user });
			})
			.post('/login/request', zValidator('json', registerEmailDto), limiter({ limit: 10, minutes: 60 }), async (c) => {
				const { email } = c.req.valid('json');
				await this.iamService.createLoginRequest({ email });
				return c.json({ message: 'Verification email sent' });
			})
			.post('/login/verify', zValidator('json', signInEmailDto), limiter({ limit: 10, minutes: 60 }), async (c) => {
				const { email, token } = c.req.valid('json');
				const session = await this.iamService.verifyLoginRequest({ email, token });
				const sessionCookie = this.luciaService.lucia.createSessionCookie(session.id);
				setCookie(c, sessionCookie.name, sessionCookie.value, {
					path: sessionCookie.attributes.path,
					maxAge: sessionCookie.attributes.maxAge,
					domain: sessionCookie.attributes.domain,
					sameSite: sessionCookie.attributes.sameSite as any,
					secure: sessionCookie.attributes.secure,
					httpOnly: sessionCookie.attributes.httpOnly,
					expires: sessionCookie.attributes.expires
				});
				return c.json({ message: 'ok' });
			})
			.post('/logout', requireAuth, async (c) => {
				const sessionId = c.var.session.id;
				await this.iamService.logout(sessionId);
				const sessionCookie = this.luciaService.lucia.createBlankSessionCookie();
				setCookie(c, sessionCookie.name, sessionCookie.value, {
					path: sessionCookie.attributes.path,
					maxAge: sessionCookie.attributes.maxAge,
					domain: sessionCookie.attributes.domain,
					sameSite: sessionCookie.attributes.sameSite as any,
					secure: sessionCookie.attributes.secure,
					httpOnly: sessionCookie.attributes.httpOnly,
					expires: sessionCookie.attributes.expires
				});
				return c.json({ status: 'success' });
			})
			.patch('/email', requireAuth, zValidator('json', updateEmailDto), limiter({ limit: 10, minutes: 60 }), async (c) => {
				const json = c.req.valid('json');
				await this.iamService.dispatchEmailVerificationRequest(c.var.user.id, json.email);
				return c.json({ message: 'Verification email sent' });
			})
			// this could also be named to use custom methods, aka /email#verify
			// https://cloud.google.com/apis/design/custom_methods
			.post('/email/verification', requireAuth, zValidator('json', verifyEmailDto), limiter({ limit: 10, minutes: 60 }), async (c) => {
				const json = c.req.valid('json');
				await this.iamService.processEmailVerificationRequest(c.var.user.id, json.token);
				return c.json({ message: 'Verified and updated' });
			});
	}
}
