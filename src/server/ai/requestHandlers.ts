// TODO WES BOS Remove
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { error, type RequestEvent } from '@sveltejs/kit';
import { transcript_with_utterances } from './queries';
import { generate_ai_notes } from './openai';
import { save_ai_notes_to_db } from './db';

export async function aiNoteRequestHandler({ request, locals }: RequestEvent) {
	const data = await request.formData();
	const show_number = parseInt(data.get('show_number')?.toString() || '');

	if (!show_number) {
		error(400, 'Invalid Show Number');
	}

	const show = await locals.prisma.show.findUnique({
		where: { number: show_number },
		include: {
			transcript: transcript_with_utterances
		}
	});

	if (!show?.transcript) {
		error(400, 'No show, or no transcript for this show');
	}
	// delete any existing ai notes
	await locals.prisma.aiShowNote.deleteMany({
		where: {
			show: {
				number: show_number
			}
		}
	});

	// Get the AI transcript for this show
	const result = await generate_ai_notes(show);
	// Save to DB
	console.log(`🤖 Saving AI Notes to DB for Show ${show_number}`);
	console.dir(result);
	await save_ai_notes_to_db(result, show);

	return { message: 'AI Notes Created' };
}
