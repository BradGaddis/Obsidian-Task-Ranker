import { getAPI } from 'obsidian-dataview';
import { Notice } from "obsidian"


const labels = ["Lowest", "Falling", "Neutral", "Raising", "Max"];


async function updateFileContent(path: string) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file && file instanceof this.app.vault.MarkdownFile) {
        const oldContent = await this.app.vault.read(file);
        // const newContent = oldContent + "\n\nAdditional text added by plugin.";
        // await this.app.vault.modify(file, newContent);
        new Notice(`${path} File updated!`);
    } else {
        new Notice("File not found or not a markdown file.");
    }
}

function extractTag(text: string, tag: string) {
    let match = text.match(new RegExp(`(?:\\s${tag}\\s+|${tag}:)(\\S+)`, 'i'))
    return match ? match[1] : ""
}

export function removeTags(text: string) {
    text = text.replace(/si:\S+/gi, "")
    .replace(/li:\S+/gi, "")
    .replace(/el:\S+/gi, "")
    .replace(/rec:\S+/gi, "")
    // .replace(/pri:\S+/gi, "")
    // .replace(/sch:/gi, "scheduled: ")
    return text.trim()
}

function getPriority(text: string) : number {
    if (text.includes("🔺")) {
        return 10
    }
    if (text.includes("⏫")) {
        return 5
    }
    if (text.includes("🔽")) {
     return -1
    }
    if (text.includes("⏬")) {
     return -10
    }
    return 1
}

function scheduledTime(text: string) {
    let match = text.match(/^(\d{1,2})(:\d{2})?( ?- ?(\d{1,2})(:\d{2})?)?/i);
    return match ? match[0] : "";
}

function isDue(scheduledTag : string, checkNow: string = "") {
    if (!scheduledTag) return false;
    const parseTime = (str: string) => {
        let [sHour, sMinute] = str.split(':');
        const hour = parseInt(sHour, 10);
        const minute = sMinute ? parseInt(sMinute, 10) : 0;
        return { hour, minute };
    };
    
    const parts = scheduledTag.split(/\s*-\s*/);
    const startTime = parseTime(parts[0]);
    
    if (checkNow) {
        const checkParts = checkNow.split(/\s*-\s*/);
        let checkStartTime = parseTime(checkParts[0])
        
        if ( startTime.hour < checkStartTime.hour ) {
            return scheduledTag
        } else if (startTime.hour == checkStartTime.hour && startTime.minute < checkStartTime.minute) {
            return scheduledTag
        }
        return checkNow

    }
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startTime.hour, startTime.minute);


    if (parts.length === 1 ) {
        return now >= startDate;
    } else {
        const endTime = parseTime(parts[1]);
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endTime.hour, endTime.minute);
        return now >= startDate && now < endDate;
    }
}


export function getTasks(app: TaskRanker) {
    const dv = getAPI();
    let taskList = []
    
    if (!dv) {
        console.error("Dataview API not available");
        return [];
    }

    const pages = dv.pages('#rankedTasks');

    for (const page of pages) {
        const tasks = page.file.tasks.where(t => !t.completed);

        const today = new Date().toISOString().split("T")[0]



        for (const task of tasks) {
            let scheduledDate = task.scheduled ? task.scheduled.toISODate() : null
            let ignore = task.text.includes(" ig") || (task.section.subpath && task.section.subpath.includes(" ig")) || !task.text

            if (ignore || task.parent ) {
                continue
            }


            // if
            // console.log(todayISO, task.scheduled)
            if (ignore || task.parent || (scheduledDate && scheduledDate > today)) {
                continue
            }
            

            let shortImpact = parseFloat(extractTag(task.text, "si")) || 1
            let longImpact = parseFloat(extractTag(task.text, "li")) || 1
            let energyLevel = extractTag(task.text, "el") || "!"
            let wipedEnergy = false

            let scheduledTag = scheduledTime(task.text)
            let priority = parseFloat(extractTag(task.text, "pri")) || 1
            
            for (let child of task.children) {
                if (child.checked) {
                    continue
                }
                
                // if (scheduledDate && scheduledDate !== todayISO) {
                //     continue
                // }
                
                if (!wipedEnergy) {
                    energyLevel = ""
                    shortImpact = 0
                    longImpact = 0
                    wipedEnergy = true
                }
                
                let childscheduledTag = scheduledTime(child.text)
                childscheduledTag = isDue(childscheduledTag, scheduledTag)
                if (childscheduledTag && childscheduledTag != scheduledTag)
                {
                    task.text = task.text.replace(scheduledTag, childscheduledTag)
                    scheduledTag = childscheduledTag
                }

                energyLevel += extractTag(child.text, "el") || "!"
                shortImpact += parseFloat(extractTag(child.text, "si")) || 1
                longImpact += parseFloat(extractTag(child.text, "li")) || 1
                priority += getPriority(task.text)

            }

            let energyLevelNum = energyLevel ? energyLevel.length : 1

            let fullImpact = shortImpact + longImpact


            let priorityBonus = 1;


            if (priority != 1) {
                priorityBonus = priority
            }

            const predictionIndex = app.settings.mlp?.predict(getTime());
            if (priorityBonus > 0) {
                switch (predictionIndex) {
                    case 0: // Low energy 
                        priorityBonus = (1 / energyLevelNum);
                        break;
                    case 1: // Falling energy 
                        priorityBonus = energyLevelNum * 0.5; 
                        break;
                    case 3: // Raising energy 
                        priorityBonus = energyLevelNum * 0.75; // Adjust 0.75 as needed
                        break;
                    case 4: // Max energy
                        priorityBonus *= energyLevelNum;
                        break;
                    default:
                        break;
                }
            }
            
            
            
            let baseWeight =
            shortImpact * app.settings.shortTermImpactWeight +
            longImpact * app.settings.longTermImpactWeight +
            fullImpact * app.settings.fullImpactWeight +
            energyLevelNum * app.settings.effortLevelWeight;
            
                
            if (scheduledTag) {
                if (isDue(scheduledTag) || (scheduledDate && scheduledDate > today)) {
                    baseWeight = Infinity 
                }
                else {
                    priorityBonus = 0

                }
            }
                
            let finalWeight = baseWeight * priorityBonus;


            task["finalWeight"] = finalWeight;
            task["baseImpact"] = baseWeight;
            task["priority"] = priority;
            task["priorityBonus"] = priorityBonus;
            taskList.push(task)
        }

    }

    taskList.sort((a, b) => b.finalWeight - a.finalWeight)
    return taskList.slice(0, app.settings.displayLimit)
}


export function getTime() {
    const now = new Date();
    let currentHour = now.getHours();
    let minutes = now.getMinutes();

    // // Round minutes to nearest 15
    // let roundedMinutes = Math.round(minutes / 15) * 15;

    // // If rounding minutes reaches 60, increment hour
    // if (roundedMinutes === 60) {
    //     roundedMinutes = 0;
    //     currentHour = (currentHour + 1) % 24;  // wrap around if 23 -> 0
    // }
    return [currentHour, minutes]
}

export function predict(app: TaskRanker) {
  
    const prediction = app.settings.mlp?.predict(getTime())
    return labels[prediction]
    
}


let productivityMap = {
    "lowest":  [1, 0, 0, 0, 0],
    "falling": [0, 1, 0, 0, 0] ,
    "neutral": [0, 0, 1, 0, 0],
    "raising": [0, 0, 0, 1, 0] ,
    "max":     [0, 0, 0, 0, 1],
 }

 
function getTodayString() : string {
     const now = new Date()
     return `${((now.getMonth() + 1) % 12).toString()}-${now.getDate().toString()}-${now.getFullYear().toString()}`
}

export async function updateTrainingData(label: string, app: TaskRanker) {
  const currentTime = getTime(); // e.g. [22, 15]
  console.log(currentTime)
  const today: string = getTodayString(); // e.g. "1102025"
  let currentData = await loadTrainingData(app);

  // Ensure currentData is an array
  if (!Array.isArray(currentData)) {
    currentData = [];
  }

  // Find index of object containing today's date key
  const todayIndex = currentData.findIndex(obj => Object.prototype.hasOwnProperty.call(obj, today));

  const newEntry = {
    input: currentTime,
    label: productivityMap[label]
  };

  if (todayIndex !== -1) {
    // Fetch the array of entries for today
    let entriesArray = currentData[todayIndex][today];

    // Defensive check: if not an array, make it an array containing the existing entry
    // if (!Array.isArray(entriesArray)) {
    //   entriesArray = [entriesArray];
    //   currentData[todayIndex][today] = entriesArray;
    // }

    // Check if an entry with the same input already exists to avoid duplicates
    const exists = entriesArray.some(entry =>
      Array.isArray(entry.input) &&
      entry.input.length === currentTime.length &&
      entry.input.every((val, idx) => val === currentTime[idx])
    );

    if (exists) {
      new Notice("This information was already found in the data. Avoiding repeats by not saving it again.");
      return;
    }

    // Add the new entry to today's array
    entriesArray.push(newEntry);
  } else {
    currentData.push({[today]: []});
    const todayIndex = currentData.length - 1;
    
    currentData[todayIndex][today].push(newEntry)
  }

  const filePath = app.settings.trainingDataSavePath;
  const file = app.app.vault.getAbstractFileByPath(filePath);

  // Serialize with pretty printing
  const updatedJson = JSON.stringify(currentData, null, 2);

  if (file) {
    await app.app.vault.modify(file, updatedJson);
  } else {
    await app.app.vault.create(filePath, updatedJson);
  }
}





export async function trainModel(app: TaskRanker){
    const data = await loadTrainingData(app)
    let parsedData = []
    for(let i in data) {
        let date = data[i]
        for (let key in date) {
            parsedData = parsedData.concat(date[key])
        }
    }
    
    for (let epoch = 0; epoch < app.settings.trainingEpochs; epoch++) {
      for (const item of parsedData) {
        app.settings.mlp?.train(item.input, item.label);
      }
    }

}

async function loadModel(app: TaskRanker) {

}

async function saveModel(app: TaskRanker) {
    let data = app.settings.mlp?.save()

}

async function loadTrainingData(app: TaskRanker) {
    const filePath = app.settings.trainingDataSavePath;
    const file = app.app.vault.getAbstractFileByPath(filePath);

    let currentData: any[] = [];

    if (file) {
        try {
            const content = await app.app.vault.read(file);
            currentData = JSON.parse(content);
            if (!Array.isArray(currentData)) currentData = [];
        } catch (e) {
            console.error("Failed to parse existing JSON data; starting from empty", e);
        }
    }
    return currentData
}



export async function saveTask( app: TaskRanker, task: Object, newTask?: boolean) {
    const file = app.app.vault.getAbstractFileByPath(task.path)
    if (!file) return

        const fileText = await this.app.vault.read(file)
        const lines = fileText.split('\n')

        let thisLine = lines[task.line] ?? ''
        let newText = await app.getTasksAPI().executeToggleTaskDoneCommand(thisLine, task.path)
        console.log(newText)
        lines[task.line] = newText 
        // lines.splice(task.line, 0, newText)

      await this.app.vault.modify(file, lines.join('\n'))
    // }
  }