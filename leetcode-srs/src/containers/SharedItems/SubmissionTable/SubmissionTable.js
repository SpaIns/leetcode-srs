import React from 'react'
import PropTypes from 'prop-types'
import Spinner from '../../UI/Spinner/Spinner'


// Creates a generic table for visualizing submissions
// Contains standard fields: submit date, result, time spent, mem used, execution time,
//                           submit text
// Allows for the passing of additional custom fields to append as new columns
export const SubmissionTable = (props) => {

    const {
        submissions, //submissions to insert into the table
        extraFields, // Explained below
        loading, // if true, skip the table and just show loading spinner 
    } = props

    /*
    Extra fields is an array of mappings containing the following: 
    {
        title: <String title of the column>
        generator: <function that generates the cell output when provided a submission>
    }
    */
    
    // Map the result to a string
    const resultMapping = {
        true : 'Success',
        false: 'Unsuccessful'
    }
    
    let subs = null
    if (!loading && submissions) {
        subs = submissions.map(sub => {
            // Generate additional table columns for all the extra fields to append
            let extras = null
            if (extraFields) {
                extras = extraFields.map(field => {
                    return (
                        <td>{field['generator'](sub)}</td>
                    )
                })
            }

            // Generate the base attributes and add any extra fields if they exist
            return (
                <tr key={sub._id}>
                    <td>{new Date(sub.submit_date).toDateString()}</td>
                    <td> {resultMapping[sub.result]} </td>
                    <td>{new Date(sub.time_spent * 1000).toISOString().substr(11, 8)}</td>
                    <td>{sub.mem_used}</td>
                    <td>{sub.execution_time}</td>
                    <td><pre><code>{sub.text}</code></pre></td>
                    {extras}
                </tr>
            )
            }

        )
    }
    
    let extraTitles = null
    if (extraFields) {
        extraTitles = extraFields.map(field => {
            return (
                <th key={field['title']}>{field['title']}</th>
            )
        })
    }
    let titles = (
        <tr>
            <th key='date'>Submit Date</th>
            <th key='result'>Result</th>
            <th key='time_spent'>Time Spent (HH:MM:SS)</th>
            <th key='mem_used'>Memory Used</th>
            <th key='exec_time'>Execution Time (s)</th>
            <th key='sub_text'>Submission Text</th>
            {extraTitles}
        </tr>
    )

    return (
        <div>
            <table>
                <tbody>
                    {titles}
                    {loading && <Spinner/>}
                    {!loading && subs}
                </tbody>
            </table>
        </div>
    )
}

SubmissionTable.propTypes = {
    submissions: PropTypes.array,
    extraFields: PropTypes.array,
    loading: PropTypes.bool.isRequired,
}

export default SubmissionTable
