import pkg from "pg";
const { Pool } = pkg;
import CryptoJS from "crypto-js";
import fetch from "node-fetch";

const bytes = CryptoJS.AES.decrypt(
  "U2FsdGVkX19SSDotkD49WLshEBdke+f+ukvgnR2Gn6j9rMYmHbSg5UORICqo3psqTIFc9Ej0nReHhiMCVeI7A5Xq1YKEFA8mhLx7/JxYwInDRQNVKgiddK6Wy4s/zHbKJKGnnjuuFN85lx0zTOfc3qkPp+4+SkQ/61VLzmUS88w=",
  "SAsy8yWusrCoyMiQ0XSAquNTWyxrr5hM"
);
const url = bytes.toString(CryptoJS.enc.Utf8);

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: CryptoJS.AES.decrypt(
    "U2FsdGVkX19xps1hfulanyrjHLHL2qoegOQ6ABk8alD5AVssc7URrLt94YPfWHI4ws1jqEXaJQMbUsiVx4yu5A==",
    "SAsy8yWusrCoyMiQ0XSAquNTWyxrr5hM"
  ).toString(CryptoJS.enc.Utf8),
  "X-GitHub-Api-Version": "2022-11-28",
};

const testRepoName = process.argv[2];

const pool = new Pool({
  connectionString: url,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function sendRepoName(repoName) {
  const org = repoName.split("/")[0];
  const repo = repoName.split("/")[1];
  try {
    const fetchingRepo = await fetch(
      `https://api.github.com/repos/${org}/${repo}`,
      {
        headers: headers,
      }
    );

    const repoInfo = await fetchingRepo.json();
    const assignmentName = repoInfo.template_repository.full_name.replace(
      org + "/",
      ""
    );
    const team = repoName.replace(
      repoInfo.template_repository.full_name + "-",
      ""
    );

    const query = `
     UPDATE "UserAssignment"
      SET "userAssignmentLink" = $1, "updatedAt" = NOW()
      WHERE "UserAssignment"."lessonAssignmentId" IN (
        SELECT "LessonAssignment"."lessonAssignmentId"
        FROM "LessonAssignment"
        JOIN "UserList" ON "UserAssignment"."userId" = "UserList"."id"
        WHERE "UserList"."githubUsername" = $2
          AND "LessonAssignment"."assignmentName" = $3
      );
    `;

    const fetchingTeamMember = await fetch(
      `https://api.github.com/orgs/${org}/teams/${team}/members`,
      {
        headers: headers,
      }
    );
    const teamMember = await fetchingTeamMember.json();

    for (const item of teamMember) {
      const client = await pool.connect();
      const values = [
        JSON.stringify({
          url: `https://github.com/${repoName}`,
          repoName,
        }),
        item.login.toLowerCase(),
        assignmentName,
      ];

      await client.query(query, values);
      client.release();
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    pool.end();
  }
}

sendRepoName(testRepoName);
