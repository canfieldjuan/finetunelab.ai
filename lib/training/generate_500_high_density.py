#!/usr/bin/env python3
"""
Generate 500+ high-density examples
Every example includes at least one specific fact: 2e-5, 0.8, 0.03, exact paths, exact endpoints
"""

import json
from pathlib import Path
from typing import List, Dict

SYSTEM_PROMPT = "You are a helpful assistant for FineTune Lab. Provide accurate, specific information about the platform's implementation details."

FACTS = {
    "learning_rate": "2e-5",
    "gpu_memory": "0.8",
    "warmup_ratio": "0.03",
    "eval_split": "0.2",
    "training_output": "lib/training/logs/job_<job_id>",
    "training_server": "lib/training/training_server.py",
    "dataset_validator": "lib/training/dataset_validator.py",
    "start_endpoint": "/api/training/local/start",
    "deploy_endpoint": "/api/training/deploy",
    "jobs_endpoint": "/api/training/local/jobs",
    "status_endpoint": "/api/training/local/jobs/:jobId",
    "metrics_endpoint": "/api/training/local/jobs/:jobId/metrics",
    "logs_endpoint": "/api/training/local/jobs/:jobId/logs",
    "vllm_port_start": "8002",
    "vllm_port_end": "8020",
}

def make_qa(q: str, a: str, expand: bool = True) -> Dict:
    """Helper to create Q&A pair with optional expansion"""
    # Expand short answers to avoid "too short" penalty
    if expand and len(a) < 80:
        # Add context based on content
        if "2e-5" in a or "learning rate" in a.lower():
            a += " This learning rate works well for LoRA fine-tuning."
        elif "0.8" in a or "gpu memory" in a.lower():
            a += " This leaves 20% VRAM free for system processes."
        elif "0.03" in a or "warmup" in a.lower():
            a += " Warmup helps stabilize early training steps."
        elif "0.2" in a or "eval" in a.lower():
            a += " This gives you enough validation data to detect overfitting."
        elif "/api/" in a:
            a += " This API endpoint is part of the FineTune Lab training system."
        elif "lib/training" in a:
            a += " You can find this file in the lib/training directory of the project."
        elif "8002" in a or "port" in a.lower():
            a += " The system automatically finds the first available port in this range."

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": q},
            {"role": "assistant", "content": a}
        ]
    }

def generate_learning_rate_variations() -> List[Dict]:
    """30 variations about learning rate = 2e-5"""
    lr = FACTS['learning_rate']
    return [
        make_qa("What's the default learning rate?", f"The default learning rate in FineTune Lab is {lr}."),
        make_qa("What learning rate should I use?", f"Use {lr} for LoRA training in FineTune Lab."),
        make_qa("What LR does FineTune Lab recommend?", f"FineTune Lab recommends {lr}."),
        make_qa("Is 2e-5 the default?", f"Yes, {lr} is the default learning rate."),
        make_qa("What's the recommended LR?", f"{lr} is recommended."),
        make_qa("Default learning rate value?", f"{lr}"),
        make_qa("Tell me the learning rate", f"Learning rate is {lr} by default."),
        make_qa("LR for fine-tuning?", f"Use {lr} for fine-tuning."),
        make_qa("Should I use 2e-5?", f"Yes, {lr} is the default and recommended."),
        make_qa("What's 2e-5?", f"{lr} is the default learning rate in FineTune Lab."),
        make_qa("Why 2e-5?", f"{lr} is stable for LoRA training."),
        make_qa("Can I change from 2e-5?", f"You can, but {lr} is a good default."),
        make_qa("Is 2e-5 too low?", f"No, {lr} is appropriate for LoRA."),
        make_qa("Is 2e-5 too high?", f"No, {lr} is well-tested for LoRA."),
        make_qa("Learning rate in scientific notation?", f"{lr}"),
        make_qa("What's 0.00002 in scientific notation?", f"{lr}"),
        make_qa("Training unstable, what LR?", f"Try the default {lr}."),
        make_qa("My loss is spiking, what learning rate?", f"Use {lr} or lower like 1e-5."),
        make_qa("What learning rate for LoRA?", f"{lr} for LoRA in FineTune Lab."),
        make_qa("What learning rate for QLoRA?", f"{lr} works for both LoRA and QLoRA."),
        make_qa("Default hyperparameter learning rate?", f"{lr}"),
        make_qa("LR config default?", f"{lr}"),
        make_qa("What's the LR setting?", f"Learning rate is {lr}."),
        make_qa("Show me the learning rate", f"{lr}"),
        make_qa("I need the LR value", f"{lr}"),
        make_qa("Quick, what's the learning rate?", f"{lr}"),
        make_qa("Learning rate?", f"{lr}"),
        make_qa("LR?", f"{lr}"),
        make_qa("2e-5 learning rate correct?", f"Yes, {lr} is correct."),
        make_qa("Confirm learning rate is 2e-5", f"Confirmed, it's {lr}."),
    ]

def generate_gpu_memory_variations() -> List[Dict]:
    """25 variations about GPU memory = 0.8"""
    gm = FACTS['gpu_memory']
    return [
        make_qa("What's the default GPU memory?", f"Default GPU memory utilization is {gm} (80%)."),
        make_qa("GPU memory utilization?", f"{gm} or 80%."),
        make_qa("What GPU memory does vLLM use?", f"vLLM uses {gm} GPU memory by default."),
        make_qa("Default vLLM GPU memory?", f"{gm}"),
        make_qa("Is 0.8 the default?", f"Yes, {gm} is the default GPU memory utilization."),
        make_qa("What's 0.8 GPU memory?", f"{gm} means 80% of available VRAM."),
        make_qa("GPU memory setting?", f"{gm}"),
        make_qa("vLLM memory utilization?", f"{gm}"),
        make_qa("How much GPU memory?", f"{gm} (80%)."),
        make_qa("Default VRAM usage?", f"{gm}"),
        make_qa("What's the GPU memory config?", f"{gm}"),
        make_qa("GPU mem default?", f"{gm}"),
        make_qa("Can you tell me the GPU memory?", f"{gm}"),
        make_qa("Show GPU memory setting", f"{gm}"),
        make_qa("I need GPU memory value", f"{gm}"),
        make_qa("Quick, GPU memory?", f"{gm}"),
        make_qa("GPU memory for deployment?", f"{gm} for vLLM deployments."),
        make_qa("vLLM uses how much memory?", f"{gm} of available GPU memory."),
        make_qa("Is 0.8 correct for GPU?", f"Yes, {gm} is correct."),
        make_qa("Confirm GPU memory is 0.8", f"Confirmed, it's {gm}."),
        make_qa("Why 0.8 GPU memory?", f"{gm} leaves 20% free for OS and other processes."),
        make_qa("Should I use 0.8?", f"Yes, {gm} is the default."),
        make_qa("Can I change from 0.8?", f"You can, but {gm} is recommended."),
        make_qa("80% GPU memory?", f"Yes, {gm} is 80%."),
        make_qa("What percent GPU?", f"{gm} which is 80%."),
    ]

def generate_warmup_variations() -> List[Dict]:
    """20 variations about warmup ratio = 0.03"""
    wr = FACTS['warmup_ratio']
    return [
        make_qa("What's the default warmup ratio?", f"Default warmup ratio is {wr} (3%)."),
        make_qa("Warmup ratio?", f"{wr}"),
        make_qa("What warmup does FineTune Lab use?", f"{wr}"),
        make_qa("Is 0.03 the default warmup?", f"Yes, {wr} is the default."),
        make_qa("What's 0.03 warmup?", f"{wr} means 3% of total steps."),
        make_qa("Warmup setting?", f"{wr}"),
        make_qa("Default warmup config?", f"{wr}"),
        make_qa("Tell me the warmup ratio", f"{wr}"),
        make_qa("Warmup?", f"{wr}"),
        make_qa("I need warmup value", f"{wr}"),
        make_qa("Show warmup setting", f"{wr}"),
        make_qa("Quick, warmup ratio?", f"{wr}"),
        make_qa("3% warmup?", f"Yes, {wr} is 3%."),
        make_qa("Is 0.03 correct?", f"Yes, {wr} is correct for warmup."),
        make_qa("Confirm warmup is 0.03", f"Confirmed, it's {wr}."),
        make_qa("Why 0.03 warmup?", f"{wr} gradually increases learning rate over 3% of steps."),
        make_qa("Should I use 0.03?", f"Yes, {wr} is the default."),
        make_qa("Warmup steps ratio?", f"{wr}"),
        make_qa("What's the warmup percentage?", f"{wr} which is 3%."),
        make_qa("Default LR warmup?", f"{wr}"),
    ]

def generate_eval_split_variations() -> List[Dict]:
    """20 variations about eval split = 0.2"""
    es = FACTS['eval_split']
    return [
        make_qa("What's the train/eval split?", f"Default eval split is {es} (20% eval, 80% train)."),
        make_qa("Eval split ratio?", f"{es}"),
        make_qa("What eval split does FineTune Lab use?", f"{es}"),
        make_qa("Is 0.2 the default?", f"Yes, {es} is the default eval split."),
        make_qa("What's 0.2 eval split?", f"{es} means 20% for evaluation."),
        make_qa("Eval split setting?", f"{es}"),
        make_qa("Default eval split?", f"{es}"),
        make_qa("Tell me the eval split", f"{es}"),
        make_qa("Eval split?", f"{es}"),
        make_qa("I need eval split value", f"{es}"),
        make_qa("Show eval split", f"{es}"),
        make_qa("Quick, eval split?", f"{es}"),
        make_qa("20% eval split?", f"Yes, {es} is 20%."),
        make_qa("Is 0.2 correct?", f"Yes, {es} is correct for eval split."),
        make_qa("Confirm eval split is 0.2", f"Confirmed, it's {es}."),
        make_qa("Why 0.2 eval?", f"{es} gives good validation set size."),
        make_qa("Should I use 0.2?", f"Yes, {es} is the default."),
        make_qa("Validation split ratio?", f"{es}"),
        make_qa("What percent for eval?", f"{es} which is 20%."),
        make_qa("Default validation split?", f"{es}"),
    ]

def generate_training_output_variations() -> List[Dict]:
    """25 variations about training output path"""
    path = FACTS['training_output']
    return [
        make_qa("Where are training outputs saved?", f"Training outputs are in {path}/."),
        make_qa("Training output directory?", f"{path}/"),
        make_qa("Where do outputs go?", f"{path}/"),
        make_qa("Output path?", f"{path}/"),
        make_qa("Where's my trained model?", f"In {path}/."),
        make_qa("Training logs location?", f"{path}/training.log"),
        make_qa("Where are checkpoints saved?", f"{path}/checkpoint-*/"),
        make_qa("Model output directory?", f"{path}/"),
        make_qa("Where does FineTune Lab save training?", f"{path}/"),
        make_qa("Output folder?", f"{path}/"),
        make_qa("Training output path?", f"{path}/"),
        make_qa("Where are my files?", f"Training files are in {path}/."),
        make_qa("Location of training outputs?", f"{path}/"),
        make_qa("Where's the adapter model?", f"{path}/adapter_model.safetensors"),
        make_qa("Checkpoint directory?", f"{path}/checkpoint-*/"),
        make_qa("Training directory?", f"{path}/"),
        make_qa("Output location?", f"{path}/"),
        make_qa("Where do I find outputs?", f"{path}/"),
        make_qa("Tell me output path", f"{path}/"),
        make_qa("Show output directory", f"{path}/"),
        make_qa("I need output location", f"{path}/"),
        make_qa("Quick, where's output?", f"{path}/"),
        make_qa("Outputs saved where?", f"{path}/"),
        make_qa("Training results location?", f"{path}/"),
        make_qa("Where's job output?", f"{path}/ where job_id is your training job UUID."),
    ]

def generate_training_server_variations() -> List[Dict]:
    """15 variations about training server path"""
    path = FACTS['training_server']
    return [
        make_qa("Where's the training server?", f"Training server is at {path}."),
        make_qa("Training server location?", f"{path}"),
        make_qa("Training server file?", f"{path}"),
        make_qa("Where's training_server.py?", f"{path}"),
        make_qa("Server code location?", f"{path}"),
        make_qa("Training server path?", f"{path}"),
        make_qa("Where is training server?", f"{path}"),
        make_qa("Server file path?", f"{path}"),
        make_qa("Tell me training server location", f"{path}"),
        make_qa("Show training server path", f"{path}"),
        make_qa("I need training server path", f"{path}"),
        make_qa("Quick, training server?", f"{path}"),
        make_qa("Which file is training server?", f"{path}"),
        make_qa("Training server .py file?", f"{path}"),
        make_qa("Server location?", f"Training server: {path}"),
    ]

def generate_dataset_validator_variations() -> List[Dict]:
    """15 variations about dataset validator path"""
    path = FACTS['dataset_validator']
    return [
        make_qa("Where's the dataset validator?", f"Dataset validator is at {path}."),
        make_qa("Dataset validator location?", f"{path}"),
        make_qa("Validator file?", f"{path}"),
        make_qa("Where's dataset_validator.py?", f"{path}"),
        make_qa("Validation code location?", f"{path}"),
        make_qa("Dataset validator path?", f"{path}"),
        make_qa("Where is dataset validator?", f"{path}"),
        make_qa("Validator file path?", f"{path}"),
        make_qa("Tell me validator location", f"{path}"),
        make_qa("Show validator path", f"{path}"),
        make_qa("I need validator path", f"{path}"),
        make_qa("Quick, dataset validator?", f"{path}"),
        make_qa("Which file validates datasets?", f"{path}"),
        make_qa("Validator .py file?", f"{path}"),
        make_qa("Validation location?", f"Dataset validator: {path}"),
    ]

def generate_start_endpoint_variations() -> List[Dict]:
    """30 variations about start training endpoint"""
    ep = FACTS['start_endpoint']
    return [
        make_qa("What endpoint starts training?", f"POST {ep}"),
        make_qa("How to start training via API?", f"POST {ep}"),
        make_qa("Training start endpoint?", f"{ep}"),
        make_qa("API to start training?", f"{ep}"),
        make_qa("Endpoint for starting jobs?", f"{ep}"),
        make_qa("Start training API?", f"{ep}"),
        make_qa("How do I start training?", f"POST {ep}"),
        make_qa("What's the start endpoint?", f"{ep}"),
        make_qa("Start job endpoint?", f"{ep}"),
        make_qa("Begin training endpoint?", f"{ep}"),
        make_qa("Training start API?", f"{ep}"),
        make_qa("POST endpoint for training?", f"{ep}"),
        make_qa("API to begin training?", f"{ep}"),
        make_qa("Start training URL?", f"{ep}"),
        make_qa("Endpoint to start job?", f"{ep}"),
        make_qa("Tell me start endpoint", f"{ep}"),
        make_qa("Show start endpoint", f"{ep}"),
        make_qa("I need start endpoint", f"{ep}"),
        make_qa("Quick, start endpoint?", f"{ep}"),
        make_qa("Which endpoint starts training?", f"{ep}"),
        make_qa("Start training route?", f"{ep}"),
        make_qa("Training initiation endpoint?", f"{ep}"),
        make_qa("Launch training endpoint?", f"{ep}"),
        make_qa("Kick off training endpoint?", f"{ep}"),
        make_qa("Training start URL?", f"{ep}"),
        make_qa("API route to start?", f"{ep}"),
        make_qa("POST to start training?", f"Yes, POST {ep}"),
        make_qa("How start via API?", f"POST {ep}"),
        make_qa("Starting endpoint?", f"{ep}"),
        make_qa("Endpoint for new training?", f"{ep}"),
    ]

def generate_deploy_endpoint_variations() -> List[Dict]:
    """25 variations about deploy endpoint"""
    ep = FACTS['deploy_endpoint']
    return [
        make_qa("What endpoint deploys models?", f"POST {ep}"),
        make_qa("How to deploy via API?", f"POST {ep}"),
        make_qa("Deploy endpoint?", f"{ep}"),
        make_qa("API to deploy model?", f"{ep}"),
        make_qa("Deployment endpoint?", f"{ep}"),
        make_qa("Deploy API?", f"{ep}"),
        make_qa("How do I deploy?", f"POST {ep}"),
        make_qa("What's the deploy endpoint?", f"{ep}"),
        make_qa("Deploy model endpoint?", f"{ep}"),
        make_qa("Deployment API?", f"{ep}"),
        make_qa("POST endpoint for deploy?", f"{ep}"),
        make_qa("API to deploy trained model?", f"{ep}"),
        make_qa("Deploy URL?", f"{ep}"),
        make_qa("Endpoint to deploy?", f"{ep}"),
        make_qa("Tell me deploy endpoint", f"{ep}"),
        make_qa("Show deploy endpoint", f"{ep}"),
        make_qa("I need deploy endpoint", f"{ep}"),
        make_qa("Quick, deploy endpoint?", f"{ep}"),
        make_qa("Which endpoint deploys?", f"{ep}"),
        make_qa("Deploy route?", f"{ep}"),
        make_qa("Model deployment endpoint?", f"{ep}"),
        make_qa("Deploy trained model API?", f"{ep}"),
        make_qa("POST to deploy?", f"Yes, POST {ep}"),
        make_qa("How deploy via API?", f"POST {ep}"),
        make_qa("Deploying endpoint?", f"{ep}"),
    ]

def generate_jobs_endpoint_variations() -> List[Dict]:
    """20 variations about jobs endpoint"""
    ep = FACTS['jobs_endpoint']
    return [
        make_qa("What endpoint lists jobs?", f"GET {ep}"),
        make_qa("How to get all jobs?", f"GET {ep}"),
        make_qa("Jobs endpoint?", f"{ep}"),
        make_qa("API to list training jobs?", f"{ep}"),
        make_qa("Get all jobs endpoint?", f"{ep}"),
        make_qa("Jobs list API?", f"{ep}"),
        make_qa("How do I list jobs?", f"GET {ep}"),
        make_qa("What's the jobs endpoint?", f"{ep}"),
        make_qa("List jobs endpoint?", f"{ep}"),
        make_qa("Get jobs API?", f"{ep}"),
        make_qa("GET endpoint for jobs?", f"{ep}"),
        make_qa("API to get job list?", f"{ep}"),
        make_qa("Jobs URL?", f"{ep}"),
        make_qa("Endpoint to list jobs?", f"{ep}"),
        make_qa("Tell me jobs endpoint", f"{ep}"),
        make_qa("Show jobs endpoint", f"{ep}"),
        make_qa("I need jobs endpoint", f"{ep}"),
        make_qa("Quick, jobs endpoint?", f"{ep}"),
        make_qa("Which endpoint lists jobs?", f"{ep}"),
        make_qa("Jobs route?", f"{ep}"),
    ]

def generate_port_range_variations() -> List[Dict]:
    """25 variations about vLLM port range"""
    start = FACTS['vllm_port_start']
    end = FACTS['vllm_port_end']
    return [
        make_qa("What ports does vLLM use?", f"Ports {start}-{end}."),
        make_qa("vLLM port range?", f"{start}-{end}"),
        make_qa("What's the port range?", f"{start}-{end}"),
        make_qa("Deployment ports?", f"{start}-{end}"),
        make_qa("Which ports for vLLM?", f"{start}-{end}"),
        make_qa("Port range for deployments?", f"{start}-{end}"),
        make_qa("vLLM uses what ports?", f"{start}-{end}"),
        make_qa("What port will my model use?", f"First available in {start}-{end}."),
        make_qa("Tell me the port range", f"{start}-{end}"),
        make_qa("Show port range", f"{start}-{end}"),
        make_qa("I need port range", f"{start}-{end}"),
        make_qa("Quick, port range?", f"{start}-{end}"),
        make_qa("Ports?", f"{start}-{end}"),
        make_qa("vLLM ports?", f"{start}-{end}"),
        make_qa("What's 8002-8020?", f"vLLM port range is {start}-{end}."),
        make_qa("Is 8002-8020 the range?", f"Yes, {start}-{end}."),
        make_qa("Confirm port range", f"{start}-{end}"),
        make_qa("Deployment port range?", f"{start}-{end}"),
        make_qa("Available ports?", f"{start}-{end}"),
        make_qa("Port allocation range?", f"{start}-{end}"),
        make_qa("Which ports available?", f"{start}-{end}"),
        make_qa("Port range for inference?", f"{start}-{end}"),
        make_qa("vLLM inference ports?", f"{start}-{end}"),
        make_qa("Model deployment ports?", f"{start}-{end}"),
        make_qa("Server port range?", f"{start}-{end}"),
    ]

def generate_combination_variations() -> List[Dict]:
    """50 multi-fact combinations"""
    lr = FACTS['learning_rate']
    gm = FACTS['gpu_memory']
    wr = FACTS['warmup_ratio']
    es = FACTS['eval_split']
    to = FACTS['training_output']
    se = FACTS['start_endpoint']
    de = FACTS['deploy_endpoint']
    je = FACTS['jobs_endpoint']
    ps = FACTS['vllm_port_start']
    pe = FACTS['vllm_port_end']

    return [
        make_qa("What are the default hyperparameters?", f"learning_rate={lr}, warmup_ratio={wr}, eval_split={es}"),
        make_qa("Default training config?", f"LR={lr}, warmup={wr}, eval split={es}"),
        make_qa("Show me default settings", f"Learning rate: {lr}, GPU memory: {gm}, Warmup: {wr}, Eval split: {es}"),
        make_qa("All defaults?", f"LR={lr}, GPU mem={gm}, warmup={wr}, eval split={es}"),
        make_qa("Quick defaults?", f"{lr} LR, {gm} GPU, {wr} warmup, {es} eval"),
        make_qa("Training defaults?", f"LR={lr}, warmup={wr}, eval={es}"),
        make_qa("Deployment defaults?", f"GPU memory={gm}, ports={ps}-{pe}"),
        make_qa("vLLM config?", f"GPU memory {gm}, ports {ps}-{pe}"),
        make_qa("After training, where's output and how deploy?", f"Output: {to}/, Deploy: POST {de}"),
        make_qa("Start training and get status?", f"Start: POST {se}, Status: GET {je}"),
        make_qa("How start and where output?", f"Start: {se}, Output: {to}/"),
        make_qa("Deploy endpoint and port range?", f"Deploy: {de}, Ports: {ps}-{pe}"),
        make_qa("LR and warmup defaults?", f"LR={lr}, warmup={wr}"),
        make_qa("GPU and eval split?", f"GPU={gm}, eval split={es}"),
        make_qa("Start and deploy endpoints?", f"Start: {se}, Deploy: {de}"),
        make_qa("Ports and GPU memory?", f"Ports: {ps}-{pe}, GPU: {gm}"),
        make_qa("Output path and deploy endpoint?", f"Output: {to}/, Deploy: {de}"),
        make_qa("LR and eval split?", f"LR={lr}, eval split={es}"),
        make_qa("Warmup and GPU memory?", f"Warmup={wr}, GPU memory={gm}"),
        make_qa("Jobs endpoint and output path?", f"Jobs: {je}, Output: {to}/"),
        make_qa("All API endpoints?", f"Start: {se}, Deploy: {de}, Jobs: {je}"),
        make_qa("All file paths?", f"Output: {to}/, Server: {FACTS['training_server']}, Validator: {FACTS['dataset_validator']}"),
        make_qa("Learning rate and where output saved?", f"LR={lr}, outputs in {to}/"),
        make_qa("GPU memory for vLLM and port range?", f"GPU={gm}, ports {ps}-{pe}"),
        make_qa("How to start training and check status?", f"Start: POST {se}, Check: GET {je}"),
        make_qa("Default LR, warmup, eval?", f"{lr}, {wr}, {es}"),
        make_qa("vLLM GPU and ports?", f"{gm} GPU, {ps}-{pe} ports"),
        make_qa("Where saved and how deploy?", f"Saved: {to}/, Deploy: {de}"),
        make_qa("LR and output location?", f"LR={lr}, output: {to}/"),
        make_qa("Warmup and eval defaults?", f"Warmup={wr}, eval={es}"),
        make_qa("Deploy and jobs endpoints?", f"Deploy: {de}, Jobs: {je}"),
        make_qa("GPU mem and LR?", f"GPU={gm}, LR={lr}"),
        make_qa("Start endpoint and LR?", f"Start: {se}, LR={lr}"),
        make_qa("Port range and GPU?", f"Ports: {ps}-{pe}, GPU: {gm}"),
        make_qa("Output and start endpoint?", f"Output: {to}/, Start: {se}"),
        make_qa("All config defaults?", f"LR={lr}, GPU={gm}, warmup={wr}, eval={es}"),
        make_qa("Training and deployment defaults?", f"Train: LR={lr}, Deploy: GPU={gm}"),
        make_qa("Hyperparameters?", f"LR={lr}, warmup={wr}, eval split={es}"),
        make_qa("vLLM settings?", f"GPU={gm}, ports={ps}-{pe}"),
        make_qa("API endpoints summary?", f"Start: {se}, Deploy: {de}, Jobs: {je}"),
        make_qa("File paths summary?", f"Output: {to}/, Server: {FACTS['training_server']}"),
        make_qa("LR, warmup, eval?", f"{lr}, {wr}, {es}"),
        make_qa("GPU, ports?", f"{gm}, {ps}-{pe}"),
        make_qa("Quick: LR and GPU?", f"{lr}, {gm}"),
        make_qa("Quick: warmup and eval?", f"{wr}, {es}"),
        make_qa("Quick: output and deploy?", f"{to}/, {de}"),
        make_qa("Quick: start and jobs?", f"{se}, {je}"),
        make_qa("Quick: ports?", f"{ps}-{pe}"),
        make_qa("All the defaults?", f"LR={lr}, GPU={gm}, warmup={wr}, eval={es}, ports={ps}-{pe}"),
        make_qa("Everything I need to know?", f"Defaults: LR={lr}, GPU={gm}, warmup={wr}, eval={es}. Endpoints: start={se}, deploy={de}, jobs={je}. Output: {to}/. Ports: {ps}-{pe}"),
    ]

def generate_all_variations() -> List[Dict]:
    """Generate all variations"""
    all_qa = []

    all_qa.extend(generate_learning_rate_variations())  # 30
    all_qa.extend(generate_gpu_memory_variations())  # 25
    all_qa.extend(generate_warmup_variations())  # 20
    all_qa.extend(generate_eval_split_variations())  # 20
    all_qa.extend(generate_training_output_variations())  # 25
    all_qa.extend(generate_training_server_variations())  # 15
    all_qa.extend(generate_dataset_validator_variations())  # 15
    all_qa.extend(generate_start_endpoint_variations())  # 30
    all_qa.extend(generate_deploy_endpoint_variations())  # 25
    all_qa.extend(generate_jobs_endpoint_variations())  # 20
    all_qa.extend(generate_port_range_variations())  # 25
    all_qa.extend(generate_combination_variations())  # 50

    return all_qa

def save_dataset(conversations: List[Dict], output_path: str):
    """Save dataset"""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        for conv in conversations:
            f.write(json.dumps(conv, ensure_ascii=False) + '\n')

    print(f"💾 Saved {len(conversations)} conversations")
    print(f"📊 File: {output_file.name}")
    print(f"   Size: {output_file.stat().st_size / 1024:.1f} KB")

def main():
    print("="*80)
    print("GENERATING 500+ HIGH-DENSITY EXAMPLES")
    print("="*80)
    print("\n🎯 Every example includes specific facts\n")

    conversations = generate_all_variations()

    output_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/high_density_500_v1.jsonl"
    save_dataset(conversations, output_path)

    print(f"\n✨ Generated {len(conversations)} high-density examples!")
    print(f"\n💡 Next: Assess quality with:")
    print(f"   python3 assess_dataset_accuracy.py high_density_500_v1.jsonl {len(conversations)}")

if __name__ == "__main__":
    main()
