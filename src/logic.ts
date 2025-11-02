import { getAPI } from 'obsidian-dataview';
import {App, Notice } from "obsidian"
import TaskRanker from './main';
import { MLP } from "./mlp/mlp"
let storedTasks : Array<Object> = []

const labels = ["Lowest", "Falling", "Neutral", "Raising", "Max"];

// let invertedProductivityMap = 

// export function getTasks() {
//     const dv = getAPI();
    
//     if (!dv) {
//         console.error("Dataview API not available");
//         return [];
//     }

//     const pages = dv.pages('#rankedTasks');

//     for (const page of pages) {
//         const tasks = page.file.tasks.where(t => !t.completed);


//         for (const task of tasks) {
//             if (!storedTasks.includes(task))
//             {
//                 storedTasks.push(task);
//             }
//         }
//     }

//     return storedTasks;
// }


export async function updateTask(task: Object) {
    // new Notice(`${task.text} was updated`)
    // updateFileContent(task.path)
}

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

// function hasAnyTag(text: string) {
//     return text.includes("si:") || text.includes("li:") || text.includes("el:") || text.includes("rec:")
// }

function removeTags(text: string) {
    text = text.replace(/si:\S+/gi, "")
    .replace(/li:\S+/gi, "")
    .replace(/el:\S+/gi, "")
    .replace(/rec:\S+/gi, "")
    .replace(/pri:\S+/gi, "")
    // .replace(/sch:/gi, "scheduled: ")
    return text.trim()
}

function scheduled(text: string) {
    let match = text.match(/^(\d{1,2})(:\d{2})?( ?- ?(\d{1,2})(:\d{2})?)?/i);
    // match ? console.log(match) : null
    return match ? match[0] : "";
}

function isDue(scheduledTag : string, checkNow = null) {
    if (!scheduledTag) return false;
    console.log(scheduledTag)
    const parseTime = (str: string) => {
        let [hour, minute] = str.split(':');
        hour = parseInt(hour, 10);
        minute = minute ? parseInt(minute, 10) : 0;
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
    
    if (!dv) {
        console.error("Dataview API not available");
        return [];
    }

    const pages = dv.pages('#rankedTasks');

    for (const page of pages) {
        const tasks = page.file.tasks.where(t => !t.completed);

        const todayISO = new Date().toISOString()
        // console.log(todayISO)
        for (const task of tasks) {
            let scheduledDate = task.scheduled ? task.scheduled.toISODate() : null
            let ignore = task.text.includes(" ig") || (task.section.subpath && task.section.subpath.includes(" ig")) || !task.text

            if (ignore) {
                continue
            }
            // if (ignore || task.parent || (scheduledDate && scheduledDate !== todayISO) || (page.file.path.includes("Daily Notes") && page.file.name !== todayISO)) {
            //     continue
            // }

            let shortImpact = parseFloat(extractTag(task.text, "si")) || 1
            let longImpact = parseFloat(extractTag(task.text, "li")) || 1
            let energyLevel = extractTag(task.text, "el") || "!"
            let wipedEnergy = false

            let scheduledTag = scheduled(task.text)
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
                
                let childscheduledTag = scheduled(child.text)
                childscheduledTag = isDue(childscheduledTag, scheduledTag)
                if (childscheduledTag && childscheduledTag != scheduledTag)
                {
                    task.text = task.text.replace(scheduledTag, childscheduledTag)
                    scheduledTag = childscheduledTag
                }

                energyLevel += extractTag(child.text, "el") || "!"
                shortImpact += parseFloat(extractTag(child.text, "si")) || 1
                longImpact += parseFloat(extractTag(child.text, "li")) || 1
                priority += parseFloat(extractTag(child.text, "pri")) || 1

            }

            let energyLevelNum = energyLevel ? energyLevel.length : 1

            let fullImpact = shortImpact + longImpact


            let priorityBonus = 1;


            if (priority != 1) {
                priorityBonus = priority
            }



            // //Lowest 
            // if (predictionIndex == 0 && priorityBonus > 0) {
                
            //     impactWeights[0] = 1
            //     // impactWeights[2] *= 2
            //     priorityBonus = (1 / energyLevelNum);

            // // Falling
            // } else if (predictionIndex == 1 && priorityBonus > 0) {
                
            //     // impactWeights[3] *= -1
            //     priorityBonus = energyLevelNum
                
            // // Neutral
            // } 
            // else if (predictionIndex == 3 && priorityBonus > 0) {
            //     impactWeights[1] *= 1
            //     impactWeights[3] = 0
            //     priorityBonus = 1 / energyLevelNum;
                
            // // "Max
            // } else if (predictionIndex == 4 && priorityBonus > 0) {
            //     impactWeights[3] *= 2
            //     priorityBonus *= energyLevelNum;
            // }
            
            
            
            let baseWeight =
            shortImpact * app.settings.shortTermImpactWeight +
            longImpact * app.settings.longTermImpactWeight +
            fullImpact * app.settings.fullImpactWeight +
            energyLevelNum * app.settings.effortLevelWeight;
            
            // "Raising"
            
            // if (predictionIndex == 2 && priorityBonus > 0) {
            //     // priorityBonus = 1.5 * energyLevelNum;
            //     priorityBonus = 1 / (energyLevelNum * baseWeight);
                
            // }
                
                
            // if (scheduledTag) {
            //     if (isDue(scheduledTag) || (scheduledDate && scheduledDate > todayISO)) {
            //         baseWeight = Infinity 
            //     }
            //     else {
            //         priorityBonus = 0

            //     }
            // }
                
            let finalWeight = baseWeight * priorityBonus;




            let text = []
            for (let child of task.children) {
                let scheduledDate = child.scheduled ? child.scheduled.toISODate() : null

                if (child.checked) {
                    continue
                }

                // if (scheduledDate && scheduledDate !== todayISO) {
                //     continue
                // }

                text.push("\n\t- " + child.text)
            }

            task["finalWeight"] = finalWeight;
            storedTasks.push(task)

            
            // storedTasks.push({
            //     taskLink: removeTags(task.text) + text + "\n" + task.link,
            //     shortImpact,
            //     longImpact,
            //     fullImpact,
            //     energyLevel,
            //     finalWeight,
            // })
        }

    }

    storedTasks.sort((a, b) => b.finalWeight - a.finalWeight)
    return storedTasks.slice(0, app.settings.displayLimit)
}

export function updateTaskList() {
    storedTasks = []
}

export function predict(app: TaskRanker) {
    const now = new Date();
    let currentHour = now.getHours();
    let minutes = now.getMinutes();

    // Round minutes to nearest 15
    let roundedMinutes = Math.round(minutes / 15) * 15;

    // If rounding minutes reaches 60, increment hour
    if (roundedMinutes === 60) {
        roundedMinutes = 0;
        currentHour = (currentHour + 1) % 24;  // wrap around if 23 -> 0
    }

    const mlp = new MLP(2, app.settings.hiddenLayerNum, 5, app.settings.learningRate);
    const prediction = mlp.predict([currentHour, roundedMinutes])
    return labels[prediction]
    
}


let productivityMap = {
    "lowest":  [1, 0, 0, 0, 0],
    "falling": [0, 1, 0, 0, 0] ,
    "neutral": [0, 0, 1, 0, 0],
    "raising": [0, 0, 0, 1, 0] ,
    "max":     [0, 0, 0, 0, 1],
 }

 
export async function updateTrainingData(label: string, app: TaskRanker) {

    const now = new Date();
    let currentHour = now.getHours();
    let minutes = now.getMinutes();


    // Round minutes to nearest 15
    let roundedMinutes = Math.round(minutes / 15) * 15;

    const newData = [{
        "input": [currentHour, roundedMinutes] , "label" : productivityMap[label]
    }];

    console.log(newData)
  const filePath = app.settings.jsonSavePath;
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

  // Merge existing and new data (simple concatenation)
  const updatedData = currentData.concat(newData);
  console.log("saved data ", newData, updatedData)
  const updatedJson = JSON.stringify(updatedData, null, 2);

  if (file) {
    await app.app.vault.modify(file, updatedJson);
  } else {
    await app.app.vault.create(filePath, updatedJson);
  }
}




export async function trainModel(){
    const mlp = new MLP(2, app.settings.hiddenLayerNum, 5, app.settings.learningRate);
    // Train loop
    for (let epoch = 0; epoch < 10000; epoch++) {
      for (const item of trainingData) {
        mlp.train(item.input, item.label);
      }

}
}

