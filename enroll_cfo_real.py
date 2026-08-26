import urllib.request
import json
import base64

def enroll_real_cfo():
    payloads = json.load(open('samples/sample_payloads.json'))
    
    samples = [
        payloads['cfo_enrollment_1.wav'],
        payloads['cfo_enrollment_2.wav'],
        payloads['cfo_enrollment_3.wav']
    ]

    req_data = {
        'personName': 'Ramesh Kumar',
        'role': 'Chief Financial Officer (CFO)',
        'orgId': 'org_enterprise_01',
        'audioSamples': samples
    }

    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/voiceprint/enroll',
        data=json.dumps(req_data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )

    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())
        print(f"Enrolled Profile: {data['profileId']}")
        print(f"Name: {data['personName']}, Role: {data['role']}, Samples: {data['sampleCount']}")
        return data['profileId']

if __name__ == '__main__':
    enroll_real_cfo()
