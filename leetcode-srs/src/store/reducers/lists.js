import * as actions from '../actions/actionTypes'
import { updateObject } from '../../shared/utility'

const initialState = {
    // We deconstruct the current lists's attributes for easy access
    curList: null,
    curListName: null,
    curListPublic: null,

    usersLists: null,
    error: null,
    loading: false,
}

// Start a list getting process
const listStart = (state, action) => {
    return updateObject(state, {error: null, loading: true})
}

// Set the current list (presumably to one of the ones in userLists)
const listSetCurrent = (state, action) => {
    // In addition to updating the current list,
    // set the list provided to the front of lists
    const updateList = state.usersLists.filter((list) => list._id !== action.curList._id)
    // Now add the curList to the head
    updateList.splice(0,0,action.curList)
    console.log('Setting current, update list is:')
    return updateObject(state, {
        curList: action.curList,
        curListName: action.curList.name,
        curListPublic: action.curList.public,
        usersLists: updateList,
        loading: false,
    })
}

// Set the userLists (and the curList)
const listGetLists = (state, action) => {
    return updateObject(state, {
        curList: action.firstList,
        curListName: action.firstList.name,
        curListPublic: action.firstList.public,
        usersLists: action.lists,
        error: null,
        loading: false,
    })
}

// Update state to note we encounterd an error
const listError = (state, action) => {
    console.log(action)
    return updateObject(state, {error: action.error, loading: false})
}

// Clear out our state for lists
const listClear = (state, action) => {
    return updateObject(state, {
        curList: null,
        curListName: null,
        curListPublic: null,
        usersLists: null,
        error: null,
        loading: false,
    })
}

// Add a newly created list to our user's lists
// and make curList our newly added list
const listAddNewList = (state, action) => {
    return updateObject(state, {
        // Use the unified format of id and name
        curList: {
            id: action.list._id,
            name: action.list.name,
            public: action.list.public,
        },
        curListName: action.list.name,
        curListPublic: action.list.public,
        // Update the array of user's lists
        usersLists: [...state.usersLists, action.list],
        error: null,
        loading: false,
    })
}

// Add or remove problems from a list
// For now, just reset loading and error
const listUpdateProblems = (state, action) => {
    return updateObject(state, {
        error: null,
        loading: false,
    })
}

export const listReducer = (state=initialState, action) => {
    switch (action.type) {
        case actions.LISTS_START: return listStart(state, action)
        case actions.LISTS_ERROR: return listError(state, action)
        case actions.LISTS_RETRIEVE: return listGetLists(state, action)
        case actions.LISTS_SET_CURRENT: return listSetCurrent(state, action)
        case actions.LISTS_CLEAR: return listClear(state, action)
        case actions.LISTS_ADD_NEW: return listAddNewList(state, action)
        case actions.LISTS_UPDATE_PROBLEMS: return listUpdateProblems(state, action)
        default: return state
    }
}