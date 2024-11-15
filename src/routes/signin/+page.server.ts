import { fail, redirect, type Actions } from '@sveltejs/kit';
import { PUBLIC_HOME_URL } from '$env/static/public';
import { local, session } from '$lib/api/urls';
import type { AuthResponse } from '$types/reply.js';
import { redirectStore } from '$stores/server/redirect.store.js';
import type { PageServerLoad } from '../$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	let redirectUrl = url.searchParams.get('redirect');
	if (redirectUrl) redirectStore.set(redirectUrl);
	else {
		redirectStore.subscribe((value) => {
			redirectUrl = value;
		});
	}

	if (cookies.get('SID')) {
		const checkSessionApi = session.check;
		const response = await fetch(checkSessionApi.url, {
			method: checkSessionApi.method
		});
		if (response.ok) {
			redirect(302, redirectUrl || PUBLIC_HOME_URL);
		}
	}
};

export const actions = {
	local: async ({ request, fetch }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();
		const redirectUrl = data.get('redirect')?.toString();

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password are required'
			});
		}

		const signinApi = local.signin;
		const response = await fetch(signinApi.url, {
			method: signinApi.method,
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				email,
				password
			})
		});

		const signinRes = (await response.json()) as AuthResponse;
		if (response.status === 200) {
			if (!signinRes.code) return fail(400, { error: 'No code returned' });
			const sessionApi = session.issue(signinRes.code);
			const sessionRes = await fetch(sessionApi.url, {
				credentials: 'include',
				method: sessionApi.method
			});

			if (sessionRes.status === 200) {
				if (redirectUrl) {
					redirect(302, `${redirectUrl}`);
				} else {
					redirect(302, PUBLIC_HOME_URL);
				}
			}
			return fail(sessionRes.status, {
				error: 'Failed to issue session'
			});
		}

		return fail(response.status, {
			error: signinRes.message || 'Failed to sign in'
		});
	}
} satisfies Actions;
