import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { SHOW_QUERY } from '$server/ai/queries';
import { redis } from '../../hooks.server';
import { cache_mang } from '$utilities/cache_mang';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const cache_s = 600;

	setHeaders({
		'cache-control': `public s-max-age=${cache_s}, stale-while-revalidate=${cache_s}`
	});

	// let latest;

	const latest = await cache_mang(
		`homepage:latest_shows`,
		locals.prisma.show.findMany,
		SHOW_QUERY(),
		cache_s
	);

	// const latest_cached = await redis.get<LatestShow[]>(cache_key).catch((e) => {
	// 	console.log(e);
	// });
	// if (latest_cached) {
	// 	latest = latest_cached;
	// 	console.log('latest', latest);
	// } else {
	// 	latest = await locals.prisma.show.findMany(SHOW_QUERY());
	// 	if (latest) {
	// 		redis.set(cache_key, latest, {
	// 			ex: cache_s
	// 		});
	// 	}
	// }

	return {
		latest
	};
};

export const actions: Actions = {
	logout: async function logout({ locals, cookies }) {
		await locals.prisma.session.delete({
			where: {
				access_token: cookies.get('access_token')
			}
		});
		// Remove Auth Token Cookie
		cookies.delete('access_token', {
			httpOnly: true,
			path: '/',
			secure: true
		});
		return {
			message: 'Logout Successful'
		};
	},
	dump_cache: async function dump_cache() {
		await redis.flushall();
	}
};
