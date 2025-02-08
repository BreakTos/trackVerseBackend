import { Octokit, App } from "octokit";
import express from 'express';
import cors from 'cors';
import fs from 'fs'
import axios from "axios";
import { OpenAI } from 'openai';
import path from 'path'
import { fileURLToPath } from 'url';

// Define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json());



const token = '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'
const apiKey = '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';
const octokit = new Octokit({ auth: `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` });

const openai = new OpenAI({
  apiKey: apiKey,
});



// what we have to do is create a function that will go through all the projects in the projects.txt and tell the github username
// of all the contributors would be fun

async function getContributors(owner, repo) {

  try {
    const res = await octokit.request(`GET /repos/${owner}/${repo}/commits`, {
      owner: `${owner}`,
      repo: `${repo}`,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    const contributors = new Set();
    const commits = res.data;

    for (let commit of commits) {
      if (commit.author && commit.author.login) {
        contributors.add(commit.author.login);
      }
    }

    // console.log(`Contributors for ${repo}:`, contributors);
    return contributors;
  } catch (error) {
    if (error.status === 409) {
      console.warn(`The repository ${owner}/${repo} is empty.`);
    } else {
      console.error(`Failed to fetch contributors for ${owner}/${repo}:`, error.message);
    }
    return new Set();
  }
}

async function traverseProjects() {
  const data = fs.readFileSync("data_Gla/projects.txt", "utf8");
  const lines = data.split("\n");

  const owners = []
  const repos = []
  const urls = []
  lines.forEach((line, index) => {
    if (line.trim()) {
      const parts = line.split("/");
      const owner = parts[3];
      const repo = parts[4];

      if (owner !== undefined && repo !== undefined) {
        owners.push(owner);
        repos.push(repo);
        urls.push(line);
      }
    }
  });

  var collaborators = {};

  for (let i = 0; i < owners.length; ++i) {
    const owner = owners[i];
    const repo = repos[i];
    const url = urls[i];
    const contributors = await getContributors(owner, repo);
    collaborators[url] = Array.from(contributors);;
  }

  console.log(collaborators);
  fs.writeFileSync("data.json", JSON.stringify(collaborators, null, 4), "utf8");
}

// traverseProjects();
// we got all the contributors. Since we have the list of the final repos now can we check for all the contributors. 
// pick iTh repo and check what was the total LOC and commit contribution of each of the player in the repo
// Apart from LOC and commit contribution we will store for each what did he achieve with his commit, add it to userSummary

async function addData() {
  try {

    const data = fs.readFileSync("data.json", "utf8");
    const collaborators = JSON.parse(data);

    const updatedData = {};

    for (const [repoUrl, contributors] of Object.entries(collaborators)) {
      const [owner, repo] = repoUrl.split("/").slice(-2); // Extract owner and repo name
      updatedData[repoUrl] = {};

      for (let contributor of contributors) {
        try {
          const { data: commits } = await octokit.request("GET /repos/{owner}/{repo}/commits", {
            owner,
            repo,
            author: contributor,
          });

          let albrechtsFunctionalPointAnalysis = 0;

          for (const commit of commits) {
            if (commit.author.login === contributor) {
              const apiUrl = commit.url;


              const response = await axios.get(apiUrl, {
                headers: {
                  Accept: "application/vnd.github.v3+json",
                  Authorization: `Bearer ${token}`,
                },
              });

              const commitDetails = response.data;
              const files = commitDetails.files;

              for (const file of files) {
                let fileName = file.filename;
                if (fileName.indexOf('node_modules') !== -1 || fileName.indexOf('package-lock.json') !== -1) continue;
                // console.log(fileName);
                albrechtsFunctionalPointAnalysis += file.additions;
                albrechtsFunctionalPointAnalysis -= file.deletions;
              }
            }
          }


          updatedData[repoUrl][contributor] = albrechtsFunctionalPointAnalysis;

        } catch (error) {
          console.error(`Failed to fetch commits for ${contributor} in ${owner}/${repo}: ${error.message}`);
        }
      }
    }


    await fs.writeFileSync("data.json", JSON.stringify(updatedData, null, 2));
    console.log("Updated data has been saved to data.json.");

  } catch (error) {
    console.error("Error reading or parsing data.json:", error.message);
  }
}


async function updateDataStructure() {
  try {
    // Read and parse the existing data.json file
    const data = fs.readFileSync('data.json', 'utf8');
    const currentData = JSON.parse(data);

    // Initialize the updated data structure
    const updatedData = {};

    // Iterate over each repo in the current data
    for (const [repoUrl, contributors] of Object.entries(currentData)) {
      // Initialize the new structure for the repo
      updatedData[repoUrl] = {
        lastCommit: 0,
        contextBuffer: "",
        members: {},
        points: 0
      };

      // Add contributors' data under members
      for (const [contributor, loc] of Object.entries(contributors)) {
        updatedData[repoUrl].members[contributor] = {
          LOC: loc,
          summary: "",
          lastActive: "Long Time ago ...",
        };
      }
    }

    fs.writeFileSync('data.json', JSON.stringify(updatedData, null, 4), 'utf8');
    console.log("Updated Structure has been saved to data.json.");

  } catch (error) {
    console.error("Error reading or updating data.json:", error.message);
  }
}


async function updateData() {
  try {
    const data = fs.readFileSync('data.json', 'utf8');
    const currentData = JSON.parse(data);

    for (const [repoUrl, repoData] of Object.entries(currentData)) {
      const [owner, repo] = repoUrl.split("/").slice(-2); // Extract owner and repo name
      const contextBuffer = repoData.contextBuffer;

      for (const [contributor, contributorData] of Object.entries(repoData.members)) {
        // find all the patches of the contributor 
        try {
          const { data: commits } = await octokit.request("GET /repos/{owner}/{repo}/commits", {
            owner,
            repo,
            author: contributor,
          });

          let userSummary = "";
          let lastActive = "Long Time ago ...";
          for (const commit of commits) {
            if (commit.author.login === contributor) {
              const apiUrl = commit.url;

              const response = await axios.get(apiUrl, {
                headers: {
                  Accept: "application/vnd.github.v3+json",
                  Authorization: `Bearer ${token}`,
                },
              });

              const commitDetails = response.data;
              const files = commitDetails.files;
              // console.log(commitDetails,"*",lastActive)
              if (lastActive === 'Long Time ago ...') {
                const isoDate = commitDetails.commit.author.date; // ISO format date
                const readableDate = new Date(isoDate).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long', // Full month name
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true // 12-hour format
                });
                lastActive = readableDate;
              }
              console.log(lastActive)
              for (const file of files) {
                let fileName = file.filename;

                if (fileName.indexOf('node_modules') !== -1 || fileName.indexOf('package-lock.json') !== -1) continue;
                // console.log(fileName);
                const diff = file.patch;

                try {
                  // Send the diff to OpenAI to get a summary or response
                  const openaiResponse = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                      {
                        role: 'system',
                        content: 'You are an AI assistant tasked with summarizing detailed code changes from a repository. You will receive a code diff showing the user’s recent changes and a previous summary of their contributions. Your goal is to provide a structured, concise, and meaningful update to the summary, ensuring that all required elements are included. Your response must strictly follow this format, using clear and structured bullet points where needed.1. Tech Stack Used:List all specific technologies, frameworks, or tools used in the commit (e.g., MongoDB, Node.js, React).Mention only those that are directly relevant to the changes.If no new technologies were introduced, explicitly state: "No new technologies introduced."2. Main Files Modified:List each file that was modified.Provide a brief but clear explanation for why the file was changed.If multiple files serve the same purpose (e.g., refactoring across several files), group them together for clarity.Example Format:src/components/Button.js - Added new props for improved customization.server/routes/auth.js - Fixed authentication logic to prevent unauthorized access.3. Functionality Added or Improved:Clearly describe what new functionality was added or what existing functionality was improved.Explain the impact of these changes on the project.Avoid generic descriptions—be precise and outcome-focused.Example Format:Implemented lazy loading for images, reducing page load times.Refactored authentication middleware, improving security and efficiency.4. User Contribution:Clearly define how the user’s changes contribute to the overall project.Mention if the changes fix critical bugs, improve performance, or introduce key features.Highlight whether the changes align with project goals and enhance usability.Example Format:Improved API response time by optimizing database queries.Fixed a major login issue, resolving an existing user complaint.5. Verdict (Detailed Evaluation and Project-Wide Impact)Your evaluation must be precise, constructive, and relevant to the projects long-term development. Follow these principles when writing the verdict:Clearly explain why the change is important in the context of the project’s goals.Mention measurable benefits such as improved performance, security, usability, or maintainability.Highlight whether the change aligns with existing project objectives or introduces a feature crucial for future scalability.Avoid generic praise and describe the actual value of the work.If the contribution is meaningful, highlight why it matters.If the changes are minor or ineffective, provide constructive feedback on how to improve. In addition to this, make sure the data is perfect concerning future references for a complete project summary which will be the summary for the whole project hence do not include any objective details.'
                      },                      
                      { 
                        role: 'user',
                        content: `Here is a code diff: \n${diff} and previous userSummary: ${userSummary}.` 
                      },
                    ],
                    max_tokens: 150,
                    temperature: 0.7,
                  });
                  console.log(userSummary);
                  userSummary = openaiResponse.choices[0].message.content;

                } catch (error) {
                  console.error("Error calling OpenAI API:", error.message);
                  // return null;
                }
              }
            }
          }

          // Update the user's summary in the data structure
          repoData.members[contributor].summary = userSummary;
          repoData.members[contributor].lastActive = lastActive;

        } catch (error) {
          console.error(`Failed to fetch commits for ${contributor} in ${owner}/${repo}: ${error.message}`);
        }
      }
    }

    // Write the updated structure back to data.json
    fs.writeFileSync('data.json', JSON.stringify(currentData, null, 4), 'utf8');
    console.log(currentData)
    console.log("Data has been successfully updated in data.json.");

  } catch (error) {
    console.error("Error updating data.json:", error.message);
  }
  console.log("Done summarizing");
}

function enrichDataWithDetails() {
  // Paths to the data.json and details files
  const dataPath = path.join(__dirname, "data.json");
  const detailsFolderPath = path.join(__dirname, "data_Gla");

  // Load data.json
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  // Load details files
  const urls = fs.readFileSync(path.join(detailsFolderPath, "urls.txt"), "utf-8")
    .split("\n")
    .map((line) => line.trim().replace(/\/$/, ""));
  const names = fs.readFileSync(path.join(detailsFolderPath, "names.txt"), "utf-8")
    .split("\n")
    .map((line) => line.trim());
  const rolls = fs.readFileSync(path.join(detailsFolderPath, "rolls.txt"), "utf-8")
    .split("\n")
    .map((line) => line.trim());

  // Build a mapping of GitHub username to name and roll number
  const detailsMap = {};
  urls.forEach((url, index) => {
    const username = url.split("/").pop().trim().toLowerCase(); // Extract username and normalize
    detailsMap[username] = {
      name: names[index] || username, // Use username if name is unavailable
      roll: rolls[index] || username, // Use username if roll is unavailable
    };
  });

  // Enrich the data.json structure
  Object.keys(data).forEach((repoUrl) => {
    const repo = data[repoUrl];
    Object.keys(repo.members).forEach((username) => {
      const usernameLowerCase = username.toLowerCase(); // Normalize case
      if (detailsMap[usernameLowerCase]) {
        repo.members[username] = {
          ...repo.members[username],
          name: detailsMap[usernameLowerCase].name,
          roll: detailsMap[usernameLowerCase].roll,
        };
      } else {
        // If no details are found, use the GitHub username for both name and roll
        repo.members[username] = {
          ...repo.members[username],
          name: username,
          roll: username,
        };
      }
    });
  });

  // Write the enriched data back to data.json
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf-8");
  console.log("Data enriched successfully!");
}

async function generateRepoSummaries() {

  const data = JSON.parse(fs.readFileSync("data.json", "utf-8"));
  // Loop through each repository in the data
  for (const repoUrl in data) {
      const repo = data[repoUrl];

      // Build a string with the summaries of each member
      let individualSummaries = "";
      for (const member in repo.members) {
          const memberDetails = repo.members[member];
          individualSummaries += `
          - ${memberDetails.name} (LOC: ${memberDetails.LOC}, Last Active: ${memberDetails.lastActive})`;
      }

      // Create a prompt to generate the overall repo progress based on individual member summaries
      const progressPrompt = `Given the following individual contributions, summarize the key features added and overall progress of the team in the repository "${repoUrl}" in about 150 words. 
Focus on specific features, functionality improvements, and completed tasks, not on LOC or vague contributions. Highlight any key functionalities built or deployed in the repo, such as new features, bug fixes, or enhancements to the project. Exclude generic statements and avoid describing team activity in terms of volume (LOC). 

${individualSummaries}`;


      try {
          // Generate the progress summary using OpenAI
          const response = await openai.chat.completions.create({
              model: "gpt-4o", // Use the appropriate model
              messages: [
                  {
                      role: "system",
                      content: "Generate a concise 150-word summary of the team's progress in repository '${repoUrl}', based on the individual contributions listed below. Highlight key contributions, feature development, and overall project progress, avoiding unnecessary details. Give ans in 10 points each point must have 20 words of meaningful data not vague"
                  },
                  {
                      role: "user",
                      content: progressPrompt
                  }
              ]
          });

          // Extract the generated progress summary and store it in contextBuffer
          const summary = response.choices[0].message.content.trim();
          repo.contextBuffer = summary; // Save the generated summary in the repo's contextBuffer
      } catch (error) {
          console.error(`Error generating summary for ${repoUrl}:`, error);
          repo.contextBuffer = "Error generating summary. Please try again.";
      }
  }

  // Save the updated data back to the file
  fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(data, null, 2), 'utf-8');
  console.log('Data successfully updated and saved to data.json');
  return data; // Return the updated data with contextBuffer filled
}




async function main() {
  await traverseProjects(); /// only names under repo
  await addData();    // names got alberetcz
  await updateDataStructure(); // structure got improvised 
  await updateData(); // generate Summary etc
  await enrichDataWithDetails();
  await generateRepoSummaries();
}

// main();


app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to TrackVerse API!' });
});

app.get("/projects", async (req, res) => {
  try {
    // Read the JSON file
    
    const fileContent =  fs.readFileSync("data.json", "utf8");
    const projects = JSON.parse(fileContent);

    // Extract all project URLs
    const projectUrls = Object.keys(projects);
    console.log(projectUrls);
    // Send the response
    res.json({
      success: true,
      data: projectUrls,
    });
  } catch (error) {
    console.error("Error reading data.json:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching project URLs.",
    });
  }
});


app.get('/data', (req, res) => {
  const filePath = path.join(__dirname, 'data.json');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err.message);
      res.status(500).send('Error sending the data file');
    }
  });
});

app.post('/tasks', async (req, res) => {
  const { task, project, points } = req.body;
  console.log(req.body);
  // Validate incoming data
  if (!task || !project || points === undefined || points <= 0) {
    return res.status(400).json({ message: 'Task, project, and valid points are required' });
  }

  const dataFilePath = 'data.json'

  try {
    // Read the data.json file
    const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

    // Check if the project exists in the data
    if (!data[project]) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Create a new task object
    const newTask = {
      task: task,
      points: points,
      createdAt: new Date().toISOString(),
      status : false
    };

    // Add the task to the project
    if(data[project].tasks === undefined) data[project].tasks = [];
    data[project].tasks.push(newTask);

    // Save the updated data back to the data.json file
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));

    // Send a success response
    res.status(200).json({ message: 'Task added successfully', task: newTask });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const techStackMap = {
  "React": [],
  "MongoDB": [],
  "Node.js": [],
  "Express": [],
  "Auth": [],
  "Mongoose": [],
  "Axios": [],
  "Vite": [],
  "CSS": [],
  "HTML": [],
  // You can add more tech stacks here as needed
};

async function processData() {
  try {
    // Read the data from data.json
    const data = fs.readFileSync('data.json', 'utf8');
    const repos = JSON.parse(data);

    // Iterate through each repository
    for (const [repoUrl, repoData] of Object.entries(repos)) {
      const repoMembers = repoData.members;

      // Iterate through each member of the repository
      for (const [contributor, memberData] of Object.entries(repoMembers)) {
        const userSummary = memberData.summary;

        // Check for tech stack keywords in the summary and add the contributor to the relevant tech stack
        for (const [tech, users] of Object.entries(techStackMap)) {
          if (userSummary.toLowerCase().includes(tech.toLowerCase())) {
            techStackMap[tech].push(contributor);
          }
        }
      }
    }

    // Log the results or save to a file
    console.log('Tech Stack Map:', techStackMap);
    fs.writeFileSync('techStackMap.json', JSON.stringify(techStackMap, null, 4), 'utf8');
    console.log('Tech stack map saved to techStackMap.json.');

  } catch (error) {
    console.error("Error reading or processing data.json:", error.message);
  }
}
processData()

app.get('/techStackMap', (req, res) => {
  const filePath = path.join(__dirname, 'techStackMap.json');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err.message);
      res.status(500).send('Error sending the data file');
    }
  });
});

