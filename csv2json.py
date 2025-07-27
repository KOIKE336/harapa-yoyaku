#!/usr/bin/env python3
import csv
import json
import os
import glob
from datetime import datetime, timedelta

def get_latest_csv():
    csv_files = glob.glob(r'\\gw2\logo_csv\*.csv')
    if not csv_files:
        return None
    return max(csv_files, key=os.path.getmtime)

def parse_time_slots(time_str):
    if not time_str or time_str.strip() == '':
        return []
    
    slots = []
    for slot in time_str.split(';'):
        slot = slot.strip()
        if '～' in slot:
            start_time, end_time = slot.split('～')
            start_time = start_time.replace('：', ':').strip()
            end_time = end_time.replace('：', ':').strip()
            slots.append((start_time, end_time))
    return slots

def merge_continuous_slots(slots):
    if not slots:
        return []
    
    slots.sort()
    merged = []
    current_start, current_end = slots[0]
    
    for start, end in slots[1:]:
        if start == current_end:
            current_end = end
        else:
            merged.append((current_start, current_end))
            current_start, current_end = start, end
    
    merged.append((current_start, current_end))
    return merged

def create_iso_datetime(date_str, time_str):
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    time_obj = datetime.strptime(time_str, '%H:%M').time()
    return datetime.combine(date_obj, time_obj).isoformat()

def process_csv():
    csv_file = get_latest_csv()
    if not csv_file:
        print("No CSV files found in \\gw2\\logo_csv\\")
        return
    
    events = []
    event_id = 1
    
    with open(csv_file, 'r', encoding='cp932') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            date = row.get('5:date', '').strip()
            if not date:
                continue
            
            rooms = row.get('1:checkbox', '').strip()
            if not rooms:
                continue
            
            lastname_1 = row.get('244:lastname', '').strip()
            firstname_1 = row.get('244:firstname', '').strip()
            lastname_2 = row.get('91:lastname', '').strip()
            firstname_2 = row.get('91:firstname', '').strip()
            
            name = ''
            if lastname_1 or firstname_1:
                name = f"{lastname_1} {firstname_1}".strip()
            elif lastname_2 or firstname_2:
                name = f"{lastname_2} {firstname_2}".strip()
            
            if not name:
                name = "予約者不明"
            
            room_list = [room.strip() for room in rooms.split(';') if room.strip()]
            
            for room in room_list:
                time_slots_str = ''
                calendar_id = room
                
                if '会議室' in room or 'さくら' in room:
                    time_slots_str = row.get('7:checkbox', '').strip()
                    calendar_id = '会議室(さくら)'
                elif '相談室' in room or 'スミレ' in room or 'コスモス' in room:
                    time_slots_str = row.get('8:checkbox', '').strip()
                    calendar_id = '相談室(スミレ・コスモス)'
                elif 'テレワークルームA' in room:
                    time_slots_str = row.get('234:checkbox', '').strip()
                    calendar_id = 'テレワークルームA'
                elif 'テレワークルームB' in room:
                    time_slots_str = row.get('235:checkbox', '').strip()
                    calendar_id = 'テレワークルームB'
                
                if not time_slots_str:
                    continue
                
                slots = parse_time_slots(time_slots_str)
                merged_slots = merge_continuous_slots(slots)
                
                for start_time, end_time in merged_slots:
                    event = {
                        'id': str(event_id),
                        'calendarId': calendar_id,
                        'title': f"{name} ({room})",
                        'start': create_iso_datetime(date, start_time),
                        'end': create_iso_datetime(date, end_time)
                    }
                    events.append(event)
                    event_id += 1
    
    os.makedirs(r'\\gw2\contents\easybook', exist_ok=True)
    
    with open(r'\\gw2\contents\easybook\events.json', 'w', encoding='utf-8') as f:
        json.dump(events, f, ensure_ascii=False, indent=2)
    
    print(f"Processed {len(events)} events from {csv_file}")

if __name__ == '__main__':
    process_csv()