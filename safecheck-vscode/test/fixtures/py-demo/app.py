import yaml
import subprocess

def load_yaml(data):
    return yaml.load(data)

def run_cmd(command):
    return subprocess.run(command, shell=True)
