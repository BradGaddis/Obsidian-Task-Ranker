import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {getTasks, updateTask, updateTaskList, predict, updateTrainingData, trainModel} from "./logic"
import {TaskRankerSettings, DEFAULT_SETTINGS} from "./settings"


export default class TaskRanker extends Plugin {
	settings: TaskRankerSettings;

	async onload() {
		
		this.registerMarkdownCodeBlockProcessor("taskranker", (source, el : HTMLElement, ctx) => {
			el.empty()
		
			const div = el.createDiv();
			const header = div.createDiv()
			header.createEl("h1", { text: `Ranked Tasks | Your current energy level appears to be: ${predict(this)}`});

			this.updateStatus(header)
			const buttonContainer = el.createDiv();
			buttonContainer.style.display = "flex";
			buttonContainer.style.gap = "8px"; 

			const fullTaskContainer = div.createDiv()
			updateTaskList();

			this.updateTasks(fullTaskContainer)

			const labels = ["lowest", "falling", "neutral", "raising", "max"];

			labels.forEach(label => {
				const button = buttonContainer.createEl("button", { text: label });
				button.addEventListener("click", async () => {
					new Notice(`${label} clicked!`);
					await updateTrainingData(label, this)
					if (this.settings.retrain){
						await trainModel()
					}
				});
			});
			const updateButton = buttonContainer.createEl("button", { text: "update" });
				updateButton.addEventListener("click", () => {
					fullTaskContainer.empty()
					updateTaskList();
					this.updateStatus(header)
					this.updateTasks(fullTaskContainer)
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

	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateStatus(headerdiv: HTMLElement){
		// headerdiv.textContent = `Ranked Tasks | Your current energy level appears to be: ${predict(this)}`
		headerdiv.empty()
		headerdiv.createEl("h1", { text: `Ranked Tasks | Your current energy level appears to be: ${predict(this)}`});

	}

	updateTasks(div: HTMLElement) {
		const tasks = getTasks(this);
		for (let task of tasks) {
			const taskDivContainer = div.createDiv();
			taskDivContainer.style.gap = "8px";

			const checkbox = taskDivContainer.createEl("input");
			checkbox.type = "checkbox";

			// Define an async function to update the task
			async function updateTaskChecked(isChecked: boolean) {
				await updateTask(task);
			}

			// Add the event listener as a normal function (not async)
			checkbox.addEventListener("change", (event) => {
				const isChecked = (event.target as HTMLInputElement).checked;
				updateTaskChecked(isChecked).catch(err => {
					console.error("Failed to update task", err);
					new Notice("Failed to update task");
				});
			});

			taskDivContainer.appendText(` ${task.text} | ${task.finalWeight}`);
			// div.appendChild(taskDivContainer)
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
				.setValue(this.plugin.settings.jsonSavePath)
				.onChange(async (value) => {
            this.plugin.settings.jsonSavePath = value;
            await this.plugin.saveSettings();
          })
			})
	}
}
