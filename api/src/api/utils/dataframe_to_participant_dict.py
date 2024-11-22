from collections import defaultdict
import pandas as pd

def dataframe_to_participant_dict(dataframe: pd.DataFrame):
    participants = dataframe.to_dict('records')

    transformed_participants = [
        {
            'id': index + 1,
            'name': row['Name'],
            'religion': row['Religion'],
            'gender': row['Gender'],
            'partner': row['Partner'],
            'couple_id': None,
        }
        for index, row in enumerate(participants)
    ]
    transformed_participants = _assign_couple_ids(transformed_participants)
    return transformed_participants

def _assign_couple_ids(data):
    couple_map = defaultdict(lambda: next_couple_id[0])
    next_couple_id = [1]

    for row in data:
        partner_name = row['partner']
        if partner_name:
            couple_key = tuple(sorted([row['name'], partner_name]))
            
            couple_id = couple_map[couple_key]
            row['couple_id'] = couple_id
            
            # Increment the counter if this is a new couple
            if couple_id == next_couple_id[0]:
                next_couple_id[0] += 1
        else:
            row['couple_id'] = None

        del row['partner']
    
    return data


if __name__ == "__main__":
    # Data input
    # data = {
    #     'Name': ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank'],
    #     'Religion': ['Christian', 'Jewish', 'Muslim', 'Hindu', 'Buddhist', 'Atheist'],
    #     'Gender': ['Female', 'Male', 'Male', 'Male', 'Female', 'Male'],
    #     'Partner': ['Bob', 'Alice', None, 'Eve', 'David', None]
    # }
    data = {
        'Name': [
            'John Doe', 'Jane Doe', 'Ali Hassan', 'Rachel Green', 'Ross Green',
            'Chandler Bing', 'Monica', 'Joey', 'Phoebe', 'Akshay'
        ],
        'Religion': [
            'Christian', 'Christian', 'Muslim', 'Jewish', 'Jewish', 
            'other', 'Muslim', 'Jewish', 'Christian', 'Muslim'
        ],
        'Gender': [
            'Male', 'Female', 'Male', 'Female', 'Male', 
            'Male', 'Female', 'Male', 'Female', 'Male'
        ],
        'Partner': ['Jane Doe', 'John Doe', None, 'Ross Green', 'Rachel Green', None, None, None, None, None]
    }


    df = pd.DataFrame(data)
    print(dataframe_to_participant_dict(df))
