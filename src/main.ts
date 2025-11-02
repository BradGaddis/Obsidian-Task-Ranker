import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {getTasks, saveTask, predict, updateTrainingData, trainModel, removeTags} from "./logic"
import {TaskRankerSettings, DEFAULT_SETTINGS} from "./settings"
import { MLP } from './mlp/mlp';


export default class TaskRanker extends Plugin {
	settings: TaskRankerSettings;
	div : HTMLElement
	header : HTMLElement
	fullTaskContainer : HTMLElement

	async onload() {
		this.registerEvent(
			this.app.metadataCache.on(
			// @ts-ignore
			'dataview:metadata-change',
			(...args: any[]) => {
				switch (args[0]) {
				case 'update':
					this.updateAll()
					// fullTaskContainer.empty()
					// this.updateStatus(header)
					// this.updateTasks(fullTaskContainer)
					break
				case 'rename':
					// this.forgetTasks(args[2])
					// this.loadTasks(args[1].path, getters.get('showingPastDates'))
					// break
				}
			}
			)
		)

		this.registerMarkdownCodeBlockProcessor("taskranker", (source, el : HTMLElement, ctx) => {
			el.empty()
		
			this.div = el.createDiv();
			this.header = this.div.createDiv()

			this.header.createEl("h1", { text: `Ranked Tasks | Your current energy level appears to be: ${predict(this)}`});

			this.updateStatus(this.header)
			const buttonContainer = el.createDiv();
			buttonContainer.style.display = "flex";
			buttonContainer.style.gap = "8px"; 

			this.fullTaskContainer = this.div.createDiv()

			const labels = ["lowest", "falling", "neutral", "raising", "max"];

			labels.forEach(label => {
				const button = buttonContainer.createEl("button", { text: label });
				button.addEventListener("click", async () => {
					new Notice(`${label} clicked!`);
					await updateTrainingData(label, this)
					if (this.settings.retrain){
						await trainModel(this)
					}
					this.updateAll()
				});
			});

			const updateButton = buttonContainer.createEl("button", { text: "Refresh List / Update" });
				updateButton.addEventListener("click", () => {
					this.updateAll()
			});

		});



		await this.loadSettings();

		this.addSettingTab(new TaskRankerSettingTab(this.app, this));

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		// this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) }
		this.settings.mlp = new MLP(2, this.settings.hiddenLayerNum, 5, this.settings.learningRate)


	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateAll() {
		this.fullTaskContainer.empty()
		this.updateStatus()
		this.updateTasks()
	}

	updateStatus(){
		this.header.empty()
		this.header.createEl("h1", { text: `Ranked Tasks | Your current energy level appears to be: ${predict(this)}`});

	}

	updateTasks() {
		const tasks = getTasks(this);
		for (let task of tasks) {
			const taskDivContainer = this.fullTaskContainer.createEl("table");
			taskDivContainer.style.gap = "8px";

			
			this.formatContainer(task, taskDivContainer)
		}
	}

	getTasksAPI() {
		return this.app.plugins.plugins['obsidian-tasks-plugin'].apiV1;

	}

	formatContainer(task: object, container: HTMLElement): any {
		const regex = /\[([^\]]+)\]\(([^)]+)\)/;
		const match = task.text.match(regex);
		container.style.padding = "10px"
		const checkbox = container.createEl("input");
		checkbox.type = "checkbox";

		checkbox.addEventListener("change", async (event) => {
			await saveTask(this, task, false)
			// const isChecked = (event.target as HTMLInputElement).checked;
		});
		let taskcontainer;
		if (match) {
			taskcontainer = container.createEl("a", {text: removeTags(match[1]), href: match[2]})
		} else {
			taskcontainer = container.createEl("span", {text: removeTags(task.text)})
		}
		
		taskcontainer.appendText(` | `)

		const button : HTMLElement = container.createEl("button", {text: "Jump to Task"})
		button.addEventListener("click", () => this.jumpToTask(task))
		container.style.alignItems = "center"
		
		for (let subtask of task.subtasks) {
			if (subtask.completed) {
				continue
			}
			let subcontainer = container.createDiv()
			this.formatContainer(subtask, subcontainer)
		}
	}

	async jumpToTask(task) {
		// Open the file in the active pane or new pane
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(this.app.vault.getFileByPath(task.path));
		// Get the Markdown editor view of the opened file
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			console.log(task)
			const editor = view.editor;
			// editor.scrollIntoView({ from: { task.position.start.line, ch: task.position.start.col }, to: { line, ch: col } });
			editor.setCursor({ line: task.position.start.line, ch: task.position.start.col});
		}
	}
	
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class TaskRankerSettingTab extends PluginSettingTab {
	plugin: TaskRanker;

	constructor(app: App, plugin: TaskRanker) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		

		new Setting(containerEl).setName("Let your tasks rank themselves").setHeading();

		new Setting(containerEl)  
			.setName('Number of Tasks to display in block')
			.addSlider(slider => slider.setDynamicTooltip()
				.setValue(this.plugin.settings.displayLimit)
				.onChange(async (value) => {
					this.plugin.settings.displayLimit = value
					await this.plugin.saveSettings();

				}) 
		)
			

		new Setting(containerEl)  
			.setName('Short Term Impact Weight')  
			.addSlider(slider => slider.setDynamicTooltip()
			.setLimits(.01, 1, .01)
			.setValue(this.plugin.settings.shortTermImpactWeight)

			.onChange(async (value) => {
					this.plugin.settings.shortTermImpactWeight = value
					await this.plugin.saveSettings();

				}) 
			);
		
		
		new Setting(containerEl)  
			.setName('Long Term Impact Weight')  
			.addSlider(slider => slider.setDynamicTooltip()
			.setLimits(.01, 1, .01)

			.setValue(this.plugin.settings.longTermImpactWeight)

			.onChange(async (value) => {
					this.plugin.settings.longTermImpactWeight = value
					await this.plugin.saveSettings();

				}) 
			);

		new Setting(containerEl)  
			.setName('Full Impact Weight')  
			.addSlider(slider => slider.setDynamicTooltip()
			.setLimits(.01, 1, .01)

			.setValue(this.plugin.settings.fullImpactWeight)

			.onChange(async (value) => {
					this.plugin.settings.fullImpactWeight = value
					await this.plugin.saveSettings();

				}) 
			);

		new Setting(containerEl)  
			.setName('Effort Level Weight')  
			.addSlider(slider => slider.setDynamicTooltip()
			.setLimits(.01, 1, .01)

			.setValue(this.plugin.settings.effortLevelWeight)

			.onChange(async (value) => {
					this.plugin.settings.effortLevelWeight = value
					await this.plugin.saveSettings();

				}) 
			);



		new Setting(containerEl)  
			.setName('Hidden Layer Size')  
			.setDesc('How many hidden layers you would like to train with')  
			.addSlider(slider => slider.setDynamicTooltip()
			.setValue(this.plugin.settings.hiddenLayerNum)

			.onChange(async (value) => {
					this.plugin.settings.hiddenLayerNum = value
					await this.plugin.saveSettings();

				}) 
			);

		new Setting(containerEl)  
			.setName('Learning Rate')  
			.setDesc('Adjust the learning rate')  
			.addSlider(slider => slider.setDynamicTooltip()
				.setValue(this.plugin.settings.learningRate)
				.setLimits(.001, .1, .001)
				.onChange(async (value) => {
					this.plugin.settings.learningRate = value
					await this.plugin.saveSettings();

				}) 
				
			)
		
		new Setting(containerEl)  
			.setName('Epochs')  
			.setDesc('Adjust the number of epochs')  
			.addSlider(slider => slider.setDynamicTooltip()
				.setValue(this.plugin.settings.trainingEpochs)
				.setLimits(10, 100000, 10)
				.onChange(async (value) => {
					this.plugin.settings.trainingEpochs = value
					await this.plugin.saveSettings();

				}) 
				
			)

		new Setting(containerEl)  
			.setName('Retrain Model on Each Update?')  
			.addToggle(toggle => toggle  
			.setValue(this.plugin.settings.retrain)  
			.onChange(async (value) => {  
				this.plugin.settings.retrain = value;  
				await this.plugin.saveSettings();  
				this.display();  
			})  
			)
	
		new Setting(containerEl)  
			.setName('Retrain Model Now')  
			// .setDesc('Adjust the learning rate')  
			.addButton(button => button
				.setButtonText("Retrain")
				.onClick( () => {
					new Notice("Work in progress")
					}
					
				)
			)

		new Setting(containerEl)  
			.setName('Default Save Path for JSON model traning data') 
			
			.addText(text => {
				text
				.setPlaceholder('/rankeddata.txt')
				.setValue(this.plugin.settings.trainingDataSavePath)
				.onChange(async (value) => {
            this.plugin.settings.trainingDataSavePath = value;
            await this.plugin.saveSettings();
          })
			})

		new Setting(containerEl)  
			.setName('Default save path for model traning data') 
			
			.addText(text => {
				text
				.setPlaceholder('/rankedmodeldata.txt')
				.setValue(this.plugin.settings.modelSavePath)
				.onChange(async (value) => {
            this.plugin.settings.modelSavePath = value;
            await this.plugin.saveSettings();
          })
			})
	}
}


