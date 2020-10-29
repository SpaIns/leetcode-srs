import React, {useEffect, useState, useRef, useCallback} from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import * as problemActions from '../../../store/actions/problems'
import * as listActions from '../../../store/actions/lists'
import classes from './ProblemViewer.module.css'
import Input from '../../UI/Input/Input'
import Button from '../../UI/Button/Button'
// TODO: The page is currently being refreshed with a query url schema upon form submission
// Why is this, and how can I prevent it? preventDefault on the form button does nothing

// TODO: Move the trace update to a common func library
// Function stolen from stack overflow to trace what prop changed
// to cause a page refresh
function useTraceUpdate(props) {
  const prev = useRef(props);
  useEffect(() => {
    const changedProps = Object.entries(props).reduce((ps, [k, v]) => {
      if (prev.current[k] !== v) {
        ps[k] = [prev.current[k], v];
      }
      return ps;
    }, {});
    if (Object.keys(changedProps).length > 0) {
      console.debug('Changed props:', changedProps);
    }
    prev.current = props;
  });
}

export const ProblemViewer = (props) => {
    /* Props and hooks */
    const {
        curList,
        curProblems,
        listErrors,
        getProblemSubset,
        getSearchResults,
        updateListProblems
    } = props

    // Keep track of the term being searched for
    // TODO: Should we store the last search term across the app via Redux?
    const [
        searchTerm,
        setSearchTerm
    ] = useState('Search for a Problem')

    // Keep track of the current search term query
    // This may be slightly different than the search term,
    // as this is set based on user input, and is sent to the
    // searchTerm on a delay so the searchTerm isn't constantly
    // updating as the user types
    const [
        query,
        setQuery
    ] = useState("Search for a Problem")

    // Keep track of any problems that have been updated to be included
    // or removed from a list
    const [
        currentProblemsAndState,
        setUpdatedProblems
    ] = useState(new Map())


    // Define this func earlier than other function so it can be utilized in
    // the useEffect hook below
    // This will setup the initial mapping of the problems displayed
    // and if they are in the current list or not
    const setInitialProblemStates = () => {
        // Set the current problem state
        // Create a copy of the current state that we can pass to the update hook
        if (curProblems === null) {
            // Exit early
            return
        }
        const updatedVersion = new Map(currentProblemsAndState)
        console.log('Cur list in set initial problem state')
        console.log(curList)
        const cur_problem_map = new Map(curList.problems)
        console.log('generated map:')
        console.log(cur_problem_map)
        curProblems.forEach((problem) => {
            // Only update the state if the problem is newly seen
            // otherwise keep whatever updates the user made on the page already
            if (!updatedVersion.has(problem._id)) {
                console.log('setting problem ' + problem + ' with id ' + problem._id)
                // Map the problem ID to a tuple of touched, adding
                // If touched is true, we've updated this value
                // If adding is true, we're adding this problem to the list
                // (as opposed to removing it from the list)
                updatedVersion.set(problem._id, [false, false])
                // TODO: Important! Need to do ^ as a default, but update adding based
                // on cur list's contents if this problem is in the list!
            }
        })
        setUpdatedProblems(updatedVersion)
    }

    // Constants definining the index of states within the currentProblemsAndState 
    // mapped arrays
    const TOUCHED_INDEX = 0 // Has problem been touched (made to add or remove)
    const ADDING_INDEX = 0 // Should this problem be added (or removed if false)


    useEffect(() => {
        // TODO: Why curProblems??? isnt this our problems from the list???
        if (curProblems === null) {
            // TODO: This is awful, figure out the good solution
            if (searchTerm === null || searchTerm === '' || searchTerm === 'Search for a Problem') {
                console.debug('Page refresh: getting subset')
                getProblemSubset(0, 50)
            }
            else {
                console.debug('Page refresh: getting res for ' + searchTerm)
                getSearchResults(searchTerm)
            }
        }
        else {
            console.debug('ProblemViewer: problems already exist')
            console.debug(curProblems)
        }
        console.log('Problem viewer refreshed')
        // Setup the problem states for any new-in-view problems
        setInitialProblemStates()
    }, [curProblems, getProblemSubset, getSearchResults, searchTerm])

    // Declare our function earlier than the others so useEffect can run appropriately
    // Handle submission of a search term for a problem
    // We will replace the problems displayed on the page with the results
    const handleSubmit = useCallback(
        (event) => {
            event.preventDefault()
            console.log('calling handle submit')
            console.log('Search term is ' + searchTerm)
            // TODO: Not sure if this is a great approach to take,
            // considering it's not out of the realm of possibility for
            // an actual LC problem to be called this.
            if (searchTerm === 'Search for a Problem') {
                getProblemSubset(0,50)
            }
            else {
                getSearchResults(searchTerm)
            }
        },
        [searchTerm, getSearchResults, getProblemSubset]
    )

    // Use this to override any enter key press on the page
    // This will prevent page reloads when we submit our form (text box & submit button)
    // in addition to allowing easy refreshes of results
    useEffect(() => {
        const listener = event => {
        if (event.code === "Enter" || event.code === "NumpadEnter") {
            console.log("Enter key was pressed. Run your function.");
            handleSubmit(event)
        }
        };
        document.addEventListener("keydown", listener);
        return () => {
        document.removeEventListener("keydown", listener);
        };
    }, [handleSubmit]);

    // Setup our hook so that we only update the search term after a 
    // given period
    useEffect (() => {
        const timeOutId = setTimeout(() => {
            console.log('Auto updating and querying with ' + query)
            setSearchTerm(query)
            // Auto-update the results
            // Use query since the search term may not be set in time
            // for getSearchResults to execute on the right text
            getSearchResults(query)
        }, 1000)
        return () => clearTimeout(timeOutId)
    }, [setSearchTerm, query, getSearchResults])

    /* Submission and change handlers */

    const handleChange = (event) => {
        console.info('Calling handle change, setting search term to ' + event.target.value)
        setQuery(event.target.value)
    }

    // Save any changes to the list that were made
    const saveChanges = (event) => {
        // TODO: We're going to want to have a batch update API call 
        event.preventDefault()
        // Take the list of problems and write out the changes
        // The API will expect an array of JSON objects containing IDs
        // and whether to add or remove the problem.
        const updatedProblems = []
        currentProblemsAndState.forEach((state, id) => {
            console.log('Mapping problem w/ key ' + id + ' and val ' + state)
            // A null update state indicates the state of the problem in the list didn't change
            if (state !== null && state[TOUCHED_INDEX] !== false) {
                updatedProblems.push({
                    "id" : id,
                    "add" : state[ADDING_INDEX]
                })
            }
        })
        console.log('Final array:')
        console.log(updatedProblems)
        // Send the request to update our list
        console.log(curList)
        updateListProblems(updatedProblems, curList.id)
        // Check for any errors after our request finishes
        if (listErrors !== null) {
            alert('Save failed! Please try again later.')
            return
        }
        alert('Changes saved!')
        // TODO: Should also call this on modal exit, if possible
            // Ehh... maybe not, what if user decides not to update, don't need
            // to force them to undo everything...
        // Reset the currentProblemsAndState mapping, since 'touched' and non touched
        // vars are going to be different now.
        setUpdatedProblems(new Map())
        setInitialProblemStates() 
    }

    
    // If we have more results than we allow on a page
    // use this to load the next
    // TODO: For now, if len of problems < 50, resubmit result but 50-100, etc
    // this may require another piece of state to track
    // TODO: Deferring this to a post MVP update
    // const loadNextResults = () => {
    //     console.log('load next')
    // }
    
    // If we aren't displaying the first page of results for a query,
    // use this to go back to prior results
    // const loadPrevResults = () => {
    //     console.log('load prev')
    // }

    // Simple helper to generate a link for a problem from a stub
    // TODO: Move this function to some general helper class and import it
    const createLink = (stub) => {
        return 'https://leetcode.com/problems/' + stub
    }

    // Update a selected problem state to either remove or
    // add it to a list based on what the current state already is
    const invertProblemState = (problem_id) => {
        console.log('Updating problem with id ' + problem_id + ' in list with id ' +
             curList.id + 'to ' + !currentProblemsAndState.get(problem_id)[ADDING_INDEX])
        let updatedState = new Map(currentProblemsAndState)
        let newVals = new Array(2)
        /* Why do we invert touched index in addition to state?
        The reason is because if we change the state, the change it back,
        it's as if we never changed anything, and we can avoid an attempt
        to change something that doesn't need to be changed on the backend.
        */
        newVals[TOUCHED_INDEX] = !(currentProblemsAndState.get(problem_id)[TOUCHED_INDEX])
        newVals[ADDING_INDEX] =!(currentProblemsAndState.get(problem_id)[ADDING_INDEX] )
        updatedState.set(problem_id, newVals)
        setUpdatedProblems(updatedState)
    }

    /* JSX creation */

    // Create an add-to-list or remove-from-list button depending
    // on if the problem passed is already inside the 
    const getAppropriateButton = (problem_id) => {
        const cur_state = currentProblemsAndState.get(problem_id)
        // If the problem isn't in the curState, or if it is but isn't in the list
        // Create an add-to-list button
        if ( (cur_state === undefined) || !(cur_state[ADDING_INDEX]) ) {
            return(
                <Button
                    btnType="Success"
                    clicked={() => invertProblemState(problem_id)}>
                        Add to List
                </Button>
            )
        }
        // Else create a remove from list button
        else {
            return(
                <Button
                    btnType="Danger"
                    clicked={() => invertProblemState(problem_id)}>
                        Remove From List
                </Button>
            )
        }
    }

    // Map the difficulty of a problem from a number to a String
    const difficultyMapping = {
        '1' : 'Easy',
        '2' : 'Medium',
        '3' : 'Hard'
    }

    let probs = null
    if (curProblems) {
        console.debug(curProblems)
        probs = curProblems.map(prob => {
            return (
                <tr key={prob._id}>
                    <td> {prob.id} </td>
                    <td><a href={createLink(prob.link)}>{prob.name}</a></td>
                    <td><b>{difficultyMapping[prob.difficulty]}</b></td>
                    <td>{prob.problem_text}</td>
                    <td>{getAppropriateButton(prob._id)}</td>
                </tr>
            )
            }

        )
    }


    return (
        <div>
            <form>
                <label>
                    Search for a problem:
                    <Input elementType='input' name="name" value={query} changed={handleChange}/>
                </label>
                <Input elementType="submit" value="Submit" clicked={handleSubmit}/>
            </form>
            <Input elementType="submit" value="Save Changes" clicked={saveChanges}/>
            <table>
                <tbody>
                    <tr>
                        <th>ID</th>
                        <th>Problem</th>
                        <th>Difficulty</th>
                        <th>Problem Text</th>
                        <th>Add/Remove From List</th>
                    </tr>
                    {probs}
                </tbody>
            </table>
            {/*TODO: Add support for these results - will likely need to update the API
                        to allow for selective result filtering - aka, grab results 10-20
                        Also, add a button for selecting number of results displayed? 
                        
                NOTE: Deferring this to post MVP*/}
            {/* <div>
                <Button
                    btnType="Danger"
                    clicked={loadPrevResults}>
                        Previous Results
                </Button>
                <Button
                    btnType="Success"
                    clicked={loadNextResults}>
                        Next Results
                </Button>
            </div> */}
        </div>
    )
}

ProblemViewer.propTypes = {
    curProblems: PropTypes.array,
    getAllProblems: PropTypes.func,
    getProblemSubset: PropTypes.func,
    getSearchResults: PropTypes.func,
    curList: PropTypes.object,
}

const mapStateToProps = (state) => {
    return {
        curProblems: state.problems.curProblems,
        curList: state.lists.curList, // currently selected list
        // curProblemsInList: state.lists.
        listErrors: state.lists.error,
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        // Get problems
        getProblemSubset: (start, end) => dispatch(problemActions.problemsGetSome(start, end)),
        getSearchResults: (term) => dispatch(problemActions.problemsGetSearch(term)),
        updateListProblems: (problemList, curList) => dispatch(listActions.listsUpdateProblems(problemList, curList)),
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ProblemViewer)