import { exec } from 'child_process';
import fs from 'fs/promises';
import { promisify } from 'util';
// import path from 'path';
const execAsync = promisify(exec);
// Function to check URL availability, modified to accept an optional skipUrls array
async function isUrlValid(url, skipUrls = []) {
	// Skip URL check if url is in skipUrls array
	if (skipUrls.includes(url)) {
		console.log(`Skipping URL check for future-dated content: ${url}`);
		return true; // Assume the URL is valid if we are skipping the check
	}
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
			}
		});
		return response.status !== 404;
	} catch (error) {
		console.error(`Error checking URL: ${url}`, error);
		return false; // Treat any error as an invalid URL
	}
}

// Function to extract URLs from markdown content
const extractUrls = (content) => {
	const urlRegex = /https?:\/\/[^\s\)]+/g;
	return content.match(urlRegex) || [];
};

// Function to extract date and URL from markdown content
const extractDateAndUrl = (content) => {
	const dateMatch = content.match(/^date:\s*(\d+)/m);
	const urlMatch = content.match(/^url:\s*(https?:\/\/[^\s]+)/m);
	return {
		date: dateMatch ? parseInt(dateMatch[1], 10) : null,
		url: urlMatch ? urlMatch[1] : null
	};
};

const validateTimestamps = (content) => {
	// Regex to match HH:MM:SS or MM:SS format
	const timestampRegex = /\b((?:[0-5]?[0-9]:)?[0-5]?[0-9]:[0-5][0-9])\b/g;
	const timestamps = content.match(timestampRegex) || [];
	const invalidTimestamps = timestamps.filter((timestamp) => {
		// Splitting timestamp into parts to validate HH:MM:SS or MM:SS format
		const parts = timestamp.split(':').map(Number);
		// Checking if parts are in valid range
		if (parts.length === 3) {
			// HH:MM:SS format
			return parts[0] > 59 || parts[1] > 59 || parts[2] > 59;
		} else if (parts.length === 2) {
			// MM:SS format
			return parts[0] > 59 || parts[1] > 59;
		}
		// Invalid format
		return true;
	});
	return invalidTimestamps;
};

// Function to process a single markdown file for broken links

// Modified processFile function to check for future date and specific URL
const processFile = async (filePath) => {
	const content = await fs.readFile(filePath, 'utf8');
	const { date, url } = extractDateAndUrl(content);

	const currentTime = Date.now();
	let skipUrls = [];
	if (date > currentTime && url) {
		// If the date is in the future, add the URL to skipUrls
		skipUrls.push(url);
	}

	const urls = extractUrls(content);
	const checkPromises = urls.map((url) => isUrlValid(url, skipUrls));
	const results = await Promise.all(checkPromises);
	const brokenLinks = urls.filter((_, index) => !results[index]);

	// No need to modify for invalid timestamps part
	const invalidTimestamps = validateTimestamps(content);

	return {
		brokenLinks,
		invalidTimestamps
	};
};

// Function to get new files added in the PR within ./shows directory
const getNewFilesInShows = async () => {
	const baseBranch = process.env.GITHUB_BASE_REF; // Use the base branch of the PR
	const { stdout } = await execAsync(
		`git diff --diff-filter=A --name-only ${baseBranch} HEAD -- 'shows/'`
	);
	return stdout.split('\n').filter((line) => line.startsWith('shows/'));
};

// Main function modified to check for non-.md files in ./shows
const main = async () => {
	const newFiles = await getNewFilesInShows();
	const nonMdFiles = newFiles.filter((file) => !file.endsWith('.md'));

	if (nonMdFiles.length > 0) {
		console.error('Error: Non-markdown files found in ./shows:', nonMdFiles);
		process.exit(1); // Fail if there are non-markdown files
	}

	// Filter out .md files for further processing
	const mdFiles = newFiles.filter((file) => file.endsWith('.md'));

	if (mdFiles.length === 0) {
		console.log('No new markdown files to check in ./shows.');
		return;
	}

	let hasIssues = false;
	for (const file of mdFiles) {
		const { brokenLinks, invalidTimestamps } = await processFile(file);
		if (brokenLinks.length > 0 || invalidTimestamps.length > 0) {
			hasIssues = true;
			console.log(`Issues found in ${file}:`);
			brokenLinks.forEach((link) => console.log(`Broken link: ${link}`));
			invalidTimestamps.forEach((timestamp) => console.log(`Invalid timestamp: ${timestamp}`));
		}
	}

	if (hasIssues) {
		process.exit(1);
	}
};

await main();
