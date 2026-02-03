import { readdir, unlink } from 'fs/promises';
import { join } from 'path';

const MAX_REPORTS = 5;

async function cleanupReports(reportsDir) {
    try {
        // 1. Read all .json files in the report directory=
        const files = await readdir(reportsDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        if (jsonFiles.length <= MAX_REPORTS) {
            console.log('Number of reports does not exceed the limit; no cleanup needed');
            return;
        }

        // 2. Extract timestamps from filenames and sort in descending order (newest first)
        const reportsWithTime = jsonFiles
            .map(file => {
                // Filename format: "2026-02-03 17:21:04.json"
                const timestampStr = file.slice(0, -5); // Remove ".json" extension
                const timestamp = new Date(timestampStr).getTime();
                return { file, timestamp };
            })
            .filter(item => !isNaN(item.timestamp)) // Filter out invalid timestamp formats
            .sort((a, b) => b.timestamp - a.timestamp); // Descending order: newest first

        // 3. Identify files to delete (keep only the first 5)
        const toDelete = reportsWithTime.slice(MAX_REPORTS);

        // 4. Delete outdated report files
        for (const { file } of toDelete) {
            const filePath = join(reportsDir, file);
            await unlink(filePath);
            console.log(`Deleted old report: ${file}`);
        }

        console.log(`✅ Cleanup complete. Kept the latest ${MAX_REPORTS} reports. \n`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log('Report directory does not exist; skipping cleanup');
        } else {
            console.error('Error during report cleanup:', err);
        }
    }
}

// await cleanupReports();

export default cleanupReports;
